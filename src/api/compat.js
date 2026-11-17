// A drop-in replacement for the Base44 SDK client, backed by Supabase.
//
// The app was written against `base44.entities.X.list/filter/get/create/
// update/delete/subscribe/...` and `base44.integrations.Core.UploadFile`.
// This object offers the same calls with the same shapes. All data lives in
// the Supabase `records` table (see supabase/schema.sql).
//
// No sign-in: the site talks to Supabase with the public (anon) key, exactly
// like the Base44 app let anyone with the link play.

function toError(error, fallbackStatus = 500) {
  if (!error) return null;
  const msg = error.message || String(error);
  let status = error.status || fallbackStatus;
  if (error.code === 'P0002' || /not found/i.test(msg)) status = 404;
  else if (error.code === '42501') status = 403;
  else if (/rate limit|too many/i.test(msg)) status = 429;
  const e = new Error(msg);
  e.status = status;
  e.response = { status, data: { message: msg } };
  e.data = { message: msg };
  return e;
}

const httpError = (status, message) => toError({ status, message }, status);
const isPlainObject = (v) => v && typeof v === 'object' && !Array.isArray(v);
const isPageOptions = (v) => isPlainObject(v) && ('cursor' in v || 'limit' in v || 'sort' in v || 'fields' in v);

export function createBase44Compat(supabase, opts = {}) {
  const bucket = opts.bucket || 'uploads';

  async function rpc(name, params) {
    // Retry a couple of times on network blips so a move isn't silently lost.
    let lastErr;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await supabase.rpc(name, params);
      if (!error) return data;
      lastErr = error;
      const transient = !error.code && /fetch|network|timeout|502|503|504/i.test(error.message || '');
      if (!transient) break;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
    throw toError(lastErr);
  }

  // ------------------------------------------------------------------ realtime
  const topics = new Map(); // entity -> { channel, listeners: Set }

  function emit(entity, event) {
    const t = topics.get(entity);
    if (!t) return;
    for (const cb of Array.from(t.listeners)) {
      try { cb(event); } catch (err) { console.error(`[${entity}.subscribe] listener error`, err); }
    }
  }

  async function handleMessage(entity, p) {
    if (!p || typeof p !== 'object') return;
    const ts = p.timestamp || new Date().toISOString();
    try {
      if (p.type === 'bulk') {
        const ids = p.ids || [];
        if (p.op === 'delete') {
          ids.forEach((id) => emit(entity, { type: 'delete', id, data: { id }, timestamp: ts }));
          return;
        }
        for (let i = 0; i < ids.length; i += 200) {
          const rows = await rpc('records_query', { p_entity: entity, p_filter: { id: { $in: ids.slice(i, i + 200) } }, p_sort: null, p_limit: 200, p_skip: 0 });
          (rows || []).forEach((row) => emit(entity, { type: p.op, id: row.id, data: row, timestamp: ts }));
        }
        return;
      }
      if (p.type === 'delete') {
        emit(entity, { type: 'delete', id: p.id, data: p.data || { id: p.id }, timestamp: ts });
        return;
      }
      let data = p.data;
      if (data && (data._partial || data._refetch)) {
        // Record too big for one message: fetch the whole thing.
        try { data = await rpc('records_get', { p_entity: entity, p_id: p.id }); }
        catch { return; }
      }
      emit(entity, { type: p.type, id: p.id, data, timestamp: ts });
    } catch (err) {
      console.error(`[${entity}.subscribe] could not handle message`, err);
    }
  }

  function getTopic(entity) {
    let t = topics.get(entity);
    if (t) return t;
    t = { listeners: new Set(), channel: null, everSubscribed: false };
    topics.set(entity, t);
    const channel = supabase.channel(`records:${entity}`, { config: { broadcast: { self: false } } });
    for (const ev of ['create', 'update', 'delete', 'bulk']) {
      channel.on('broadcast', { event: ev }, (msg) => handleMessage(entity, msg?.payload));
    }
    t.channel = channel;
    channel.subscribe((status) => {
      if (status !== 'SUBSCRIBED') return;
      // After a dropped connection (laptop sleep, wifi hiccup) messages sent
      // meanwhile are gone, so tell listeners to reload.
      if (t.everSubscribed) emit(entity, { type: 'resync', id: null, data: {}, timestamp: new Date().toISOString() });
      t.everSubscribed = true;
    });
    return t;
  }

  function subscribe(entity, cb) {
    const t = getTopic(entity);
    t.listeners.add(cb);
    return () => {
      t.listeners.delete(cb);
      if (t.listeners.size === 0 && topics.get(entity) === t) {
        topics.delete(entity);
        try { supabase.removeChannel(t.channel); } catch { /* ignore */ }
      }
    };
  }

  // ------------------------------------------------------------------ entities
  function query(entity, filterObj, sort, limit, skip) {
    return rpc('records_query', {
      p_entity: entity,
      p_filter: filterObj || {},
      p_sort: sort || null,
      p_limit: limit ?? null,
      p_skip: skip || 0,
    }).then((rows) => rows || []);
  }

  async function readPage(entity, filterObj, options) {
    const limit = options.limit || 50;
    const skip = options.cursor ? parseInt(options.cursor, 10) || 0 : 0;
    const rows = await query(entity, filterObj, options.sort, limit + 1, skip);
    let items = rows.slice(0, limit);
    if (options.fields) {
      const fields = Array.isArray(options.fields) ? options.fields : String(options.fields).split(',');
      items = items.map((r) => Object.fromEntries([['id', r.id], ...fields.map((f) => [f, r[f]])]));
    }
    return { items, has_more: rows.length > limit, next_cursor: rows.length > limit ? String(skip + limit) : null };
  }

  function entityHandler(entity) {
    return {
      list(sort, limit, skip) {
        if (isPageOptions(sort)) return readPage(entity, {}, sort);
        return query(entity, {}, sort, limit, skip);
      },
      filter(filterObj, sort, limit, skip) {
        if (isPageOptions(sort)) return readPage(entity, filterObj, sort);
        return query(entity, filterObj, sort, limit, skip);
      },
      get(id) {
        if (!id) return Promise.reject(httpError(404, `${entity} not found`));
        return rpc('records_get', { p_entity: entity, p_id: String(id) });
      },
      create(data) {
        return rpc('records_create', { p_entity: entity, p_data: data || {} });
      },
      async bulkCreate(items) {
        const out = [];
        for (let i = 0; i < (items || []).length; i += 500) {
          const rows = await rpc('records_bulk_create', { p_entity: entity, p_items: items.slice(i, i + 500) });
          out.push(...(rows || []));
        }
        return out;
      },
      update(id, patch) {
        return rpc('records_update', { p_entity: entity, p_id: String(id), p_patch: patch || {} });
      },
      async bulkUpdate(items) {
        const out = [];
        for (let i = 0; i < (items || []).length; i += 500) {
          const rows = await rpc('records_bulk_update', { p_entity: entity, p_items: items.slice(i, i + 500) });
          out.push(...(rows || []));
        }
        return out;
      },
      updateMany(filterObj, update) {
        return rpc('records_update_many', { p_entity: entity, p_filter: filterObj || {}, p_update: update || {} });
      },
      delete(id) {
        return rpc('records_delete', { p_entity: entity, p_id: String(id) });
      },
      deleteMany(filterObj) {
        return rpc('records_delete_many', { p_entity: entity, p_filter: filterObj || {} });
      },
      // Not in Base44. Edits a list field in one atomic step on the server, so
      // two players adding to (say) the discard pile at the same moment both
      // land instead of one overwriting the other. `path` is a field name or
      // "field.sub" for a list inside an object. Items in `remove` are ids.
      listEdit(id, path, { add = [], remove = [] } = {}) {
        return rpc('records_list_edit', {
          p_entity: entity, p_id: String(id), p_path: Array.isArray(path) ? path.map(String) : String(path).split('.'),
          p_add: add || [], p_remove: (remove || []).map(String),
        });
      },
      // Not in Base44. Atomically adds `delta` to a number ("field" or "a.b.c").
      incr(id, path, delta) {
        return rpc('records_incr', { p_entity: entity, p_id: String(id), p_path: Array.isArray(path) ? path.map(String) : String(path).split('.'), p_delta: delta });
      },
      // Not in Base44. Creates the record only if no record matches `match`
      // (checked and inserted atomically). Returns { created, record }.
      createUnique(match, data) {
        return rpc('records_create_unique', { p_entity: entity, p_match: match || {}, p_data: data || {} });
      },
      subscribe(cb) {
        return subscribe(entity, cb);
      },
    };
  }

  const handlers = new Map();
  const entities = new Proxy({}, {
    get(_, name) {
      if (typeof name !== 'string' || name === 'then') return undefined;
      if (!handlers.has(name)) handlers.set(name, entityHandler(name));
      return handlers.get(name);
    },
  });

  // -------------------------------------------------------------- integrations
  const integrations = {
    Core: {
      async UploadFile({ file }) {
        const safe = String(file?.name || 'file').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-80);
        const path = `${new Date().toISOString().slice(0, 7)}/${Math.random().toString(36).slice(2, 10)}_${safe}`;
        const { error } = await supabase.storage.from(bucket).upload(path, file, {
          contentType: file?.type || undefined, cacheControl: '31536000', upsert: false,
        });
        if (error) throw toError(error, 400);
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        return { file_url: data.publicUrl };
      },
    },
  };

  return { entities, integrations, supabase };
}
