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

window.supabase = window.supabase || {
  createClient: (url, key) => {
    const baseUrl = `${String(url).replace(/\/$/, '')}/rest/v1`;

    const request = async (path, method = 'GET', payload, customHeaders = {}) => {
      const finalPath = path.includes('?') ? path : `${path}?select=*`;

      const headers = {
        apikey: key,
        Authorization: 'Bearer ' + key,
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
            const payload = Array.isArray(rows) ? rows : [rows];
            const result = await request(
              `${table}?on_conflict=${encodeURIComponent(conflictKey)}`,
              'POST',
              payload,
              { Prefer: 'resolution=merge-duplicates,return=representation' }
            );
            return { data: result, error: null };
          },
          async then(resolve, reject) {
            try {
              const data = await request(buildPath(), 'GET');
              return resolve({ data, error: null });
            } catch (error) {
              return reject(error);
            }
          },
          async catch(reject) {
            try {
              const data = await request(buildPath(), 'GET');
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
