window.JLN_SUPABASE = window.JLN_SUPABASE || {
  url: 'https://obuldanrptloktxcffvn.supabase.co',
  anonKey: 'sb_publishable_s0yHqZtJV8xfnC7kPKxj3g_u_nR_d-6'
};

window.JLN_SUPABASE_READY = Boolean(
  window.JLN_SUPABASE &&
  window.JLN_SUPABASE.url &&
  window.JLN_SUPABASE.url.includes('supabase.co') &&
  window.JLN_SUPABASE.anonKey &&
  !window.JLN_SUPABASE.anonKey.includes('your-anon-key')
);

window.JLN_MAP = {
  toDb(item) {
    if (!item || typeof item !== 'object') return item;
    const dbItem = { ...item };
    if ('adviceTime' in dbItem) { dbItem.advice_time = dbItem.adviceTime; delete dbItem.adviceTime; }
    if ('createdAt' in dbItem) { dbItem.created_at = dbItem.createdAt; delete dbItem.createdAt; }
    if ('updatedAt' in dbItem) { dbItem.updated_at = dbItem.updatedAt; delete dbItem.updatedAt; }
    if ('latestMonitor' in dbItem) { dbItem.latest_monitor = dbItem.latestMonitor; delete dbItem.latestMonitor; }
    if ('completedAt' in dbItem) { dbItem.completed_at = dbItem.completedAt; delete dbItem.completedAt; }
    return dbItem;
  },
  fromDb(item) {
    if (!item || typeof item !== 'object') return item;
    const jsItem = { ...item };
    if ('advice_time' in jsItem) jsItem.adviceTime = jsItem.advice_time;
    if ('created_at' in jsItem) jsItem.createdAt = jsItem.created_at;
    if ('updated_at' in jsItem) jsItem.updatedAt = jsItem.updated_at;
    if ('latest_monitor' in jsItem) jsItem.latestMonitor = jsItem.latest_monitor;
    if ('completed_at' in jsItem) jsItem.completedAt = jsItem.completed_at;
    return jsItem;
  }
};

window.supabase = window.supabase || {
  createClient: (url, key) => {
    const baseUrl = `${String(url).replace(/\/$/, '')}/rest/v1`;

    const request = async (path, method = 'GET', payload, customHeaders = {}) => {
      const finalPath = path.includes('?') ? path : `${path}?select=*`;

      const headers = {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        ...customHeaders
      };

      const response = await fetch(`${baseUrl}/${finalPath.replace(/^\//, '')}`, {
        method,
        headers,
        body: payload === undefined ? undefined : JSON.stringify(payload)
      });

      const text = await response.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }

      if (!response.ok) {
        const error = new Error((data && data.message) || `Request failed: ${response.status}`);
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    };

    return {
      from(table) {
        const state = {
          columns: '*',
          orderBy: null
        };

        const buildPath = () => {
          const params = new URLSearchParams();
          params.set('select', state.columns);
          if (state.orderBy) {
            params.set('order', `${state.orderBy.field}.${state.orderBy.ascending ? 'asc' : 'desc'}`);
          }
          return `${table}?${params.toString()}`;
        };

        return {
          select(columns = '*') {
            state.columns = columns;
            return this;
          },
          order(field, options = {}) {
            state.orderBy = { field, ascending: options.ascending !== false };
            return this;
          },
          async upsert(rows, options = {}) {
            const conflictKey = options.onConflict || 'id';
            const rawRows = Array.isArray(rows) ? rows : [rows];
            const payload = rawRows.map(r => window.JLN_MAP.toDb(r));
            const result = await request(
              `${table}?on_conflict=${encodeURIComponent(conflictKey)}`,
              'POST',
              payload,
              { Prefer: 'resolution=merge-duplicates,return=representation' }
            );
            return { data: Array.isArray(result) ? result.map(window.JLN_MAP.fromDb) : result, error: null };
          },
          async delete(id) {
            try {
              const result = await request(`${table}?id=eq.${encodeURIComponent(id)}`, 'DELETE');
              return { data: result, error: null };
            } catch (err) {
              return { data: null, error: err };
            }
          },
          async then(resolve, reject) {
            try {
              const rawData = await request(buildPath(), 'GET');
              const data = Array.isArray(rawData) ? rawData.map(window.JLN_MAP.fromDb) : rawData;
              return resolve({ data, error: null });
            } catch (error) {
              return reject(error);
            }
          },
          async catch(reject) {
            try {
              const rawData = await request(buildPath(), 'GET');
              const data = Array.isArray(rawData) ? rawData.map(window.JLN_MAP.fromDb) : rawData;
              return { data, error: null };
            } catch (error) {
              return reject(error);
            }
          }
        };
      }
    };
  }
};

window.supabaseClient = window.JLN_SUPABASE_READY
  ? window.supabase.createClient(window.JLN_SUPABASE.url, window.JLN_SUPABASE.anonKey)
  : null;
