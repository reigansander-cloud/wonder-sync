// =============================================================================
// Moves everything from the old Base44 Wonder Sync app into Supabase, in one go.
//
// 1. Fill in SUPABASE_URL and SUPABASE_ANON_KEY below (Supabase: Project
//    Settings -> API; the anon/publishable key is the public one).
// 2. Open the OLD Wonder Sync site (the Base44 one) in your browser.
// 3. Open the console (F12 -> Console), paste this whole file, press Enter.
//
// It:
//   - reads every record (cards, wonders, edifices, chain symbols, games) and
//     also downloads a backup copy as wonder-sync-export.json,
//   - copies every image hosted on Base44 into your Supabase "uploads" bucket
//     and points the records at the new copies,
//   - writes the records into Supabase keeping their ids and dates.
// Nothing on Base44 is changed. Safe to run again (it updates, never duplicates).
// When it's done, `window.__wondersMigration.urlMap` holds old -> new image
// links (used to update the images that are built into the site's code).
// =============================================================================
(async () => {
  const SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co';
  const SUPABASE_ANON_KEY = 'your-anon-key';

  const ENTITIES = ['Card', 'Wonder', 'Edifice', 'ChainSymbol', 'Game', 'PlayerState'];
  // Images that are built into the site's code (resource icons, tokens, ...).
  const BUILT_IN_URLS = [
    'https://media.base44.com/images/public/6a67f916b96089d055f69fd3/02364189a_Age0NavalVictory.png',
    'https://media.base44.com/images/public/6a67f916b96089d055f69fd3/031cf4952_Age2Patronage.png',
    'https://media.base44.com/images/public/6a67f916b96089d055f69fd3/375c8824d_Age1Trophy.png',
    'https://media.base44.com/images/public/6a67f916b96089d055f69fd3/69d9afeb2_Penalty.jpeg',
    'https://media.base44.com/images/public/6a67f916b96089d055f69fd3/767901c38_Age1NavalVictory.png',
    'https://media.base44.com/images/public/6a67f916b96089d055f69fd3/7a124e570_Age2Trophy.png',
    'https://media.base44.com/images/public/6a67f916b96089d055f69fd3/8aca72127_Loss.png',
    'https://media.base44.com/images/public/6a67f916b96089d055f69fd3/97a3fa27e_Age2NavalVictory.png',
    'https://media.base44.com/images/public/6a67f916b96089d055f69fd3/9ab4c8872_Island.png',
    'https://media.base44.com/images/public/6a67f916b96089d055f69fd3/9fa52627f_Age3Patronage.png',
    'https://media.base44.com/images/public/6a67f916b96089d055f69fd3/a0c6a3363_Age3NavalVictory.png',
    'https://media.base44.com/images/public/6a67f916b96089d055f69fd3/abba9dff0_Age2Navaldefeat.png',
    'https://media.base44.com/images/public/6a67f916b96089d055f69fd3/acc30a687_NavalShield.png',
    'https://media.base44.com/images/public/6a67f916b96089d055f69fd3/be8ba8073_Age1Patronage.png',
    'https://media.base44.com/images/public/6a67f916b96089d055f69fd3/cfd17297f_Age1Navaldefeat.png',
    'https://media.base44.com/images/public/6a67f916b96089d055f69fd3/ddfc78dfa_Age3Trophy.png',
    'https://media.base44.com/images/public/6a67f916b96089d055f69fd3/e7ceb3f6d_Diplomacy.png',
    'https://media.base44.com/images/public/6a67f916b96089d055f69fd3/f26e08aec_WHITESPACE.png',
    'https://media.base44.com/images/public/6a67f916b96089d055f69fd3/f425b84c4_Age3Navaldefeat.png',
    'https://media.base44.com/images/public/user_6a19f3b0dd22f66955c17143/0051f995b_Ore2.png',
    'https://media.base44.com/images/public/user_6a19f3b0dd22f66955c17143/1454afdda_VictoryPoints.png',
    'https://media.base44.com/images/public/user_6a19f3b0dd22f66955c17143/28e646a85_MilitaryShield.png',
    'https://media.base44.com/images/public/user_6a19f3b0dd22f66955c17143/5aa2b499b_Science-Script.png',
    'https://media.base44.com/images/public/user_6a19f3b0dd22f66955c17143/895f219af_Wood2.png',
    'https://media.base44.com/images/public/user_6a19f3b0dd22f66955c17143/92c9b6924_Loom.png',
    'https://media.base44.com/images/public/user_6a19f3b0dd22f66955c17143/9346dfd79_Stone2.png',
    'https://media.base44.com/images/public/user_6a19f3b0dd22f66955c17143/9b87f2d8a_Science-Mason.png',
    'https://media.base44.com/images/public/user_6a19f3b0dd22f66955c17143/aa41c856c_Clay2.png',
    'https://media.base44.com/images/public/user_6a19f3b0dd22f66955c17143/c15020f84_Glass2.png',
    'https://media.base44.com/images/public/user_6a19f3b0dd22f66955c17143/c73f18da2_Science-Gear.png',
    'https://media.base44.com/images/public/user_6a19f3b0dd22f66955c17143/e989f6116_Papyrus2.png',
    'https://media.base44.com/images/public/user_6a19f3b0dd22f66955c17143/f75487bd5_Coin.png'
  ];
  const PAGE = 500;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const log = (m, c = '#d4a64a') => console.log(`%c${m}`, `color:${c}`);
  const sb = SUPABASE_URL.replace(/\/$/, '');
  const sbHeaders = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` };

  // ---------------------------------------------------------------- 1. export
  let appId = localStorage.getItem('base44_app_id');
  if (!appId) appId = prompt('Could not find the app id automatically. Paste your Base44 app id:');
  if (!appId) { console.error('No app id, stopping.'); return; }
  const token = localStorage.getItem('base44_access_token') || localStorage.getItem('token');
  const b44Headers = token ? { Authorization: `Bearer ${token}` } : {};

  async function getPage(entity, skip) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const res = await fetch(`/api/apps/${appId}/entities/${entity}?sort=created_date&limit=${PAGE}&skip=${skip}`, { headers: b44Headers });
      if (res.ok) return res.json();
      if (res.status === 429 || res.status >= 500) { await sleep(1500 * (attempt + 1)); continue; }
      throw new Error(`${entity}: HTTP ${res.status} ${await res.text().catch(() => '')}`);
    }
    throw new Error(`${entity}: kept getting rate-limited, try again in a minute`);
  }

  const exp = { exported_at: new Date().toISOString(), app_id: appId, entities: {}, problems: [] };
  for (const entity of ENTITIES) {
    const rows = [];
    try {
      for (let skip = 0; ; skip += PAGE) {
        const page = await getPage(entity, skip);
        if (!Array.isArray(page)) throw new Error(`${entity}: unexpected response`);
        rows.push(...page);
        if (page.length < PAGE) break;
        await sleep(300);
      }
      log(`${entity}: ${rows.length}`);
    } catch (err) {
      console.warn(`Problem with ${entity}:`, err.message);
      exp.problems.push(`${entity}: ${err.message}`);
    }
    exp.entities[entity] = rows;
    await sleep(300);
  }
  {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(exp)], { type: 'application/json' }));
    a.download = 'wonder-sync-export.json';
    document.body.appendChild(a); a.click(); a.remove();
    log('Backup downloaded as wonder-sync-export.json');
  }

  // ----------------------------------------------------------------- 2. files
  const URL_RE = /https?:\/\/(?:[a-z0-9-]+\.)*base44\.(?:app|com)\/[^\s"'`)<>\]\\]+/gi;
  let text = JSON.stringify(exp.entities);
  const urls = Array.from(new Set([...(text.match(URL_RE) || []), ...BUILT_IN_URLS]));
  const urlMap = {};
  const failed = [];
  async function hash(s) {
    const b = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(s));
    return Array.from(new Uint8Array(b)).slice(0, 5).map((x) => x.toString(16).padStart(2, '0')).join('');
  }
  async function copy(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`download HTTP ${res.status}`);
      const blob = await res.blob();
      const name = decodeURIComponent(new URL(url).pathname.split('/').pop() || 'file').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-80);
      const dest = `imported/${await hash(url)}_${name}`;
      const up = await fetch(`${sb}/storage/v1/object/uploads/${dest}`, {
        method: 'POST',
        headers: { ...sbHeaders, 'Content-Type': blob.type || 'application/octet-stream', 'cache-control': 'max-age=31536000' },
        body: blob,
      });
      if (!up.ok) {
        const body = await up.text();
        if (!/Duplicate|already exists/i.test(body)) throw new Error(`upload HTTP ${up.status} ${body}`);
      }
      urlMap[url] = `${sb}/storage/v1/object/public/uploads/${dest}`;
    } catch (err) {
      failed.push(url);
      console.warn(`could not copy ${url}: ${err.message}`);
    }
  }
  log(`Copying ${urls.length} images to Supabase...`);
  let i = 0; let done = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (i < urls.length) {
      await copy(urls[i++]);
      if (++done % 20 === 0) log(`  ${done}/${urls.length}`);
    }
  }));
  text = text.replace(URL_RE, (u) => urlMap[u] || u);
  const entities = JSON.parse(text);

  // ---------------------------------------------------------------- 3. import
  const BUILTIN = ['id', 'created_date', 'updated_date', 'created_by', 'created_by_id'];
  const DROP = new Set(['app_id', 'entity_name', 'is_sample', '_id', '__v']);
  const ts = (v) => { if (!v) return null; const s = String(v); return /[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`; };
  let total = 0;
  for (const [entity, recs] of Object.entries(entities)) {
    const rows = (recs || []).filter((r) => r && r.id).map((r) => {
      const data = {};
      for (const [k, v] of Object.entries(r)) if (!BUILTIN.includes(k) && !DROP.has(k)) data[k] = v;
      return {
        id: String(r.id), entity, data,
        created_date: ts(r.created_date) || new Date().toISOString(),
        updated_date: ts(r.updated_date) || ts(r.created_date) || new Date().toISOString(),
        created_by: r.created_by || null, created_by_id: r.created_by_id || null,
      };
    });
    for (let k = 0; k < rows.length; k += 200) {
      const res = await fetch(`${sb}/rest/v1/records?on_conflict=id`, {
        method: 'POST',
        headers: { ...sbHeaders, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(rows.slice(k, k + 200)),
      });
      if (!res.ok) { console.error(`${entity}: HTTP ${res.status} ${await res.text()}`); exp.problems.push(`${entity} import failed`); break; }
    }
    total += rows.length;
    log(`imported ${entity}: ${rows.length}`);
  }

  window.__wondersMigration = { urlMap, failed, problems: exp.problems, counts: Object.fromEntries(Object.entries(entities).map(([k, v]) => [k, v.length])) };
  log(`Done: ${total} records, ${Object.keys(urlMap).length} images copied${failed.length ? `, ${failed.length} images could not be copied (links left pointing at Base44)` : ''}.`, '#4ade80');
  if (exp.problems.length) console.warn('Problems:', exp.problems);
  return window.__wondersMigration;
})();
