const http = require('http');
const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');

const ROOT = __dirname;
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(ROOT, 'data');

async function ensureDataFiles() {
  await fsPromises.mkdir(DATA_DIR, { recursive: true });

  const files = {
    '/api/ot-cases': path.join(DATA_DIR, 'ot-cases.json'),
    '/api/pac-cases': path.join(DATA_DIR, 'pac-cases.json')
  };

  for (const file of Object.values(files)) {
    try {
      await fsPromises.access(file);
    } catch {
      await fsPromises.writeFile(file, '[]', 'utf8');
    }
  }
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

async function readJson(filePath) {
  try {
    const raw = await fsPromises.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getFilePathFromUrl(url) {
  const pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') return path.join(ROOT, 'index.html');
  return path.join(ROOT, pathname.replace(/^\//, ''));
}

function isSafePath(filePath) {
  const normalized = path.normalize(filePath);
  return normalized.startsWith(ROOT);
}

async function serveStaticFile(res, filePath) {
  let safePath = path.normalize(filePath);
  if (!isSafePath(safePath)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  // If path has no extension and doesn't exist, try .html or fallback to index.html for SPA
  if (!path.extname(safePath)) {
    try {
      await fsPromises.access(safePath);
    } catch {
      try {
        await fsPromises.access(safePath + '.html');
        safePath = safePath + '.html';
      } catch {
        safePath = path.join(ROOT, 'index.html');
      }
    }
  }

  try {
    const data = await fsPromises.readFile(safePath);
    const extension = path.extname(safePath).toLowerCase();
    const typeMap = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.ico': 'image/x-icon',
      '.webmanifest': 'application/manifest+json; charset=utf-8'
    };

    res.writeHead(200, {
      'Content-Type': typeMap[extension] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}

async function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        req.destroy();
        reject(new Error('Request too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const apiMap = {
    '/api/ot-cases': path.join(DATA_DIR, 'ot-cases.json'),
    '/api/pac-cases': path.join(DATA_DIR, 'pac-cases.json')
  };

  const filePath = apiMap[url.pathname];

  if (!filePath) {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  if (req.method === 'GET') {
    const items = await readJson(filePath);
    sendJson(res, 200, items);
    return;
  }

  if (req.method === 'PUT') {
    const data = await readRequestBody(req);
    const items = Array.isArray(data) ? data : [];
    await fsPromises.writeFile(filePath, JSON.stringify(items, null, 2), 'utf8');
    sendJson(res, 200, items);
    return;
  }

  if (req.method === 'POST') {
    const data = await readRequestBody(req);
    const items = await readJson(filePath);
    const newItem = data && typeof data === 'object' ? data : {};
    if (!newItem.id) {
      newItem.id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
    items.unshift(newItem);
    await fsPromises.writeFile(filePath, JSON.stringify(items, null, 2), 'utf8');
    sendJson(res, 201, newItem);
    return;
  }

  if (req.method === 'DELETE') {
    const data = await readRequestBody(req);
    const id = data && data.id ? String(data.id) : null;
    const items = await readJson(filePath);
    const filtered = id ? items.filter((item) => String(item.id) !== id) : [];
    await fsPromises.writeFile(filePath, JSON.stringify(filtered, null, 2), 'utf8');
    sendJson(res, 200, filtered);
    return;
  }

  sendJson(res, 405, { error: 'Method not allowed' });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname.startsWith('/api/')) {
    await handleApi(req, res);
    return;
  }

  const filePath = getFilePathFromUrl(url);
  await serveStaticFile(res, filePath);
});

(async () => {
  await ensureDataFiles();
  server.listen(PORT, () => {
    console.log(`JLN app running at http://localhost:${PORT}`);
  });
})();
