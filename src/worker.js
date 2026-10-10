// AI daily — Cloudflare Worker (API) + Workers Static Assets (frontend) + D1
const SEC = {
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'",
};
const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...SEC, ...extra } });
const err = (status, msg) => json({ error: msg }, status);
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
const J = (s, d) => { try { return JSON.parse(s); } catch { return d; } };

// best-effort per-isolate write throttle (favorites only)
const hits = new Map();
function throttled(ip) {
  const now = Date.now(), a = (hits.get(ip) || []).filter(t => now - t < 60000);
  a.push(now); hits.set(ip, a); if (hits.size > 5000) hits.clear();
  return a.length > 30;
}
// CSRF-ish guard: cross-site browser writes are rejected
function sameOrigin(req, url) {
  const o = req.headers.get('Origin');
  if (o && o !== url.origin) return false;
  const sfs = req.headers.get('Sec-Fetch-Site');
  return !sfs || sfs === 'same-origin' || sfs === 'none';
}

const STORY_SELECT = `SELECT s.*, (f.story_id IS NOT NULL) AS fav FROM stories s LEFT JOIN favorites f ON f.story_id=s.id`;
async function hydrate(db, rows) {
  if (!rows.length) return [];
  const ids = rows.map(r => r.id);
  const { results: posts } = await db.prepare(
    `SELECT story_id,handle,post_id,url,text,lang,translation_zh,likes,reposts,replies,views FROM posts
     WHERE story_id IN (SELECT value FROM json_each(?)) ORDER BY story_id, rank`).bind(JSON.stringify(ids)).all();
  const by = {}; for (const p of posts) { (by[p.story_id] ||= []).push(p); delete p.story_id; }
  return rows.map(r => ({ id: r.id, date: r.date, rank: r.rank, headline_zh: r.headline_zh, summary_zh: r.summary_zh,
    why_it_matters: r.why_it_matters, org_tag: r.org_tag, category: r.category, categories: J(r.categories_json, []),
    tags: J(r.tags_json, []), heat: r.heat, news_refs: J(r.news_refs_json, []), data_quality: r.data_quality,
    source_posts: by[r.id] || [], favorited: !!r.fav }));
}

async function api(req, env, url) {
  const db = env.DB, p = url.pathname, m = req.method;
  const ip = req.headers.get('CF-Connecting-IP') || 'local';

  if (p === '/api/health' && m === 'GET') {
    const t = await db.prepare('SELECT (SELECT count(*) FROM days) days,(SELECT count(*) FROM stories) stories,(SELECT count(*) FROM posts) posts,(SELECT max(date) FROM days) latest').first();
    return json({ ok: true, ...t, time: new Date().toISOString() });
  }
  if (p === '/api/days' && m === 'GET') {
    const { results } = await db.prepare('SELECT d.date,d.generated_at,d.source,count(s.id) story_count FROM days d LEFT JOIN stories s ON s.date=d.date GROUP BY d.date ORDER BY d.date DESC').all();
    return json({ days: results, latest: results[0] ? results[0].date : null });
  }
  let mm;
  if ((mm = p.match(/^\/api\/days\/([^/]+)$/)) && m === 'GET') {
    let date = decodeURIComponent(mm[1]);
    if (date === 'latest') date = (await db.prepare('SELECT max(date) d FROM days').first()).d;
    if (!isDate(date)) return err(date ? 400 : 404, date ? '日期格式应为 YYYY-MM-DD' : '暂无数据');
    const d = await db.prepare('SELECT * FROM days WHERE date=?').bind(date).first();
    if (!d) return err(404, '没有该日期的日报');
    const { results } = await db.prepare(`${STORY_SELECT} WHERE s.date=? ORDER BY s.rank`).bind(date).all();
    return json({ date: d.date, generated_at: d.generated_at, timezone: d.timezone, source: d.source,
      highlights: J(d.highlights_json, []), data_quality_notes: J(d.data_quality_json, []), stories: await hydrate(db, results) });
  }
  if (p === '/api/stories' && m === 'GET') {
    const sp = url.searchParams, qs = (sp.get('q') || '').trim().slice(0, 100), cat = (sp.get('category') || '').trim();
    const from = sp.get('from') || '', to = sp.get('to') || '';
    const where = [], args = [];
    if (cat) { where.push('s.id IN (SELECT story_id FROM story_categories WHERE category=?)'); args.push(cat); }
    if (isDate(from)) { where.push('s.date>=?'); args.push(from); }
    if (isDate(to)) { where.push('s.date<=?'); args.push(to); }
    for (const term of qs.split(/\s+/).filter(Boolean).slice(0, 5)) {
      // one bound param per term (D1 caps bound params at 100)
      where.push(`(instr(lower(s.headline_zh||' '||ifnull(s.summary_zh,'')||' '||ifnull(s.why_it_matters,'')||' '||ifnull(s.org_tag,'')||' '||s.tags_json||' '||s.categories_json), lower(?1x)) > 0
        OR s.id IN (SELECT story_id FROM posts WHERE instr(lower(handle||' '||ifnull(text,'')||' '||ifnull(translation_zh,'')), lower(?1x)) > 0))`.replaceAll('?1x', '?' + (args.length + 1)));
      args.push(term);
    }
    const limit = Math.min(200, Math.max(1, +sp.get('limit') || 100));
    const { results } = await db.prepare(`${STORY_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY s.date DESC, s.rank LIMIT ${limit}`).bind(...args).all();
    return json({ count: results.length, stories: await hydrate(db, results) });
  }
  if (p === '/api/trends' && m === 'GET') {
    const [perDay, days, totals, tagRows] = await db.batch([
      db.prepare('SELECT s.date, sc.category, count(*) n FROM stories s JOIN story_categories sc ON sc.story_id=s.id GROUP BY s.date, sc.category ORDER BY s.date'),
      db.prepare('SELECT d.date, count(s.id) n FROM days d LEFT JOIN stories s ON s.date=d.date GROUP BY d.date ORDER BY d.date'),
      db.prepare('SELECT category, count(*) n FROM story_categories GROUP BY category ORDER BY n DESC'),
      db.prepare('SELECT date, tags_json, heat FROM stories'),
    ]);
    const tm = {};
    for (const r of tagRows.results) for (const t of J(r.tags_json, [])) {
      const o = tm[t] ||= { topic: t, days: new Set(), stories: 0, heat: 0 }; o.days.add(r.date); o.stories++; o.heat += r.heat || 0; }
    const topics = Object.values(tm).map(o => ({ topic: o.topic, day_count: o.days.size, story_count: o.stories, last_seen: [...o.days].sort().pop(), heat_sum: Math.round(o.heat) }))
      .sort((a, b) => b.day_count - a.day_count || b.story_count - a.story_count || b.heat_sum - a.heat_sum);
    return json({ days: days.results, per_day: perDay.results, category_totals: totals.results, topics, recurring_topics: topics.filter(t => t.day_count >= 2) });
  }
  if (p === '/api/favorites' && m === 'GET') {
    const { results } = await db.prepare(`${STORY_SELECT} WHERE f.story_id IS NOT NULL ORDER BY f.created_at DESC`).all();
    return json({ count: results.length, ids: results.map(r => r.id), stories: await hydrate(db, results) });
  }
  if (p === '/api/favorites' && m === 'POST') {
    if (!sameOrigin(req, url)) return err(403, '禁止跨站请求');
    if (!(req.headers.get('Content-Type') || '').includes('application/json')) return err(415, '需要 JSON');
    if (throttled(ip)) return err(429, '操作太频繁，请稍后再试');
    const body = await req.json().catch(() => null);
    const id = String((body && body.story_id) || '').slice(0, 200);
    if (!(await db.prepare('SELECT 1 FROM stories WHERE id=?').bind(id).first())) return err(404, '故事不存在');
    const n = (await db.prepare('SELECT count(*) n FROM favorites').first()).n;
    if (n >= (+env.FAVORITES_MAX || 2000)) return err(409, '收藏已达上限');
    await db.prepare('INSERT OR IGNORE INTO favorites(story_id,created_at) VALUES (?,?)').bind(id, new Date().toISOString()).run();
    return json({ ok: true, story_id: id, favorited: true });
  }
  if ((mm = p.match(/^\/api\/favorites\/(.+)$/)) && m === 'DELETE') {
    if (!sameOrigin(req, url)) return err(403, '禁止跨站请求');
    if (throttled(ip)) return err(429, '操作太频繁，请稍后再试');
    const id = decodeURIComponent(mm[1]);
    const r = await db.prepare('DELETE FROM favorites WHERE story_id=?').bind(id).run();
    return json({ ok: true, story_id: id, removed: r.meta.changes || 0 });
  }
  if (p === '/api/export' && m === 'GET') {
    const { results: days } = await db.prepare('SELECT * FROM days ORDER BY date DESC').all();
    const out = [];
    for (const d of days) {
      const { results } = await db.prepare(`${STORY_SELECT} WHERE s.date=? ORDER BY s.rank`).bind(d.date).all();
      const stories = (await hydrate(db, results)).map(s => { s.topics = s.tags; delete s.favorited; return s; });
      out.push({ date: d.date, generated_at: d.generated_at, timezone: d.timezone, source: d.source,
        highlights: J(d.highlights_json, []), data_quality_notes: J(d.data_quality_json, []), stories });
    }
    const { results: favorites } = await db.prepare('SELECT story_id, created_at FROM favorites ORDER BY created_at').all();
    return json({ exported_at: new Date().toISOString(), days: out, favorites }, 200,
      { 'Content-Disposition': `attachment; filename="ai-daily-export-${out[0] ? out[0].date : 'empty'}.json"` });
  }
  if (p.startsWith('/api/')) return err(m === 'GET' ? 404 : 405, m === 'GET' ? 'not found' : 'method not allowed');
  return null;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) {
      try { return (await api(req, env, url)) || err(404, 'not found'); }
      catch (e) { console.error(e); return err(500, '服务器错误'); }
    }
    if (url.pathname === '/favicon.ico') return new Response(null, { status: 204 });
    const res = await env.ASSETS.fetch(req);
    const h = new Headers(res.headers); for (const [k, v] of Object.entries(SEC)) h.set(k, v);
    return new Response(res.body, { status: res.status, headers: h });
  },
};
