#!/usr/bin/env node
'use strict';
// Convert day JSON(s) -> idempotent SQL for D1.
// Usage: node scripts/json2sql.js <DATA_DIR>/2026-10-10.json [...]   -> sql/2026-10-10.sql
//        node scripts/json2sql.js --all [dir]                         -> sql/all.sql (+ one file per day)
// Default dir for --all: $DATA_DIR, else /workspace/ai-digest/data if present, else <repo>/data.
// Each day block: delete that day's posts/categories/stories, upsert the day row, insert stories/posts.
// Never touches other days or favorites. No BEGIN/COMMIT (D1 rejects explicit transactions; a file runs as one batch).
const fs = require('fs'), path = require('path');
const OUT = path.join(__dirname, '..', 'sql');
const q = v => v === null || v === undefined ? 'NULL' : typeof v === 'number' ? (Number.isFinite(v) ? String(v) : 'NULL') : "'" + String(v).replace(/'/g, "''") + "'";
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');

function validate(d, file) {
  const e = [];
  if (!isDate(d.date)) e.push('date 缺失或格式错误');
  const base = path.basename(file, '.json'); if (isDate(base) && base !== d.date) e.push(`文件名与 date 不一致`);
  if (!Array.isArray(d.stories) || !d.stories.length) e.push('stories 为空');
  const ids = new Set();
  (d.stories || []).forEach((s, i) => {
    for (const k of ['id', 'headline_zh', 'summary_zh']) if (!s[k]) e.push(`stories[${i}] 缺少 ${k}`);
    if (ids.has(s.id)) e.push(`重复 id ${s.id}`); ids.add(s.id);
    (s.source_posts || []).forEach((p, j) => {
      if (!p.handle) e.push(`stories[${i}].source_posts[${j}] 缺少 handle`);
      if (!/^https:\/\/x\.com\//.test(p.url || '')) e.push(`stories[${i}].source_posts[${j}] url 非 x.com`);
    });
  });
  if (e.length) throw new Error(file + ':\n  ' + e.join('\n  '));
}

function daySQL(d) {
  const D = q(d.date), L = [`-- ===== day ${d.date} (${d.stories.length} stories) =====`];
  L.push(`DELETE FROM posts WHERE story_id IN (SELECT id FROM stories WHERE date=${D});`);
  L.push(`DELETE FROM story_categories WHERE story_id IN (SELECT id FROM stories WHERE date=${D});`);
  L.push(`DELETE FROM stories WHERE date=${D};`);
  L.push(`INSERT INTO days(date,generated_at,timezone,source,highlights_json,data_quality_json,imported_at) VALUES (${[d.date, d.generated_at, d.timezone || 'Asia/Shanghai', d.source, JSON.stringify(d.highlights || []), JSON.stringify(d.data_quality_notes || []), new Date().toISOString()].map(q).join(',')}) ON CONFLICT(date) DO UPDATE SET generated_at=excluded.generated_at,timezone=excluded.timezone,source=excluded.source,highlights_json=excluded.highlights_json,data_quality_json=excluded.data_quality_json,imported_at=excluded.imported_at;`);
  d.stories.forEach((s, i) => {
    const cats = s.categories || [];
    // stories ids are globally unique; remove a same-id story possibly filed under another date
    L.push(`DELETE FROM posts WHERE story_id=${q(s.id)}; DELETE FROM story_categories WHERE story_id=${q(s.id)}; DELETE FROM stories WHERE id=${q(s.id)};`);
    L.push(`INSERT INTO stories(id,date,rank,headline_zh,summary_zh,why_it_matters,org_tag,category,categories_json,tags_json,heat,news_refs_json,data_quality) VALUES (${[s.id, d.date, i + 1, s.headline_zh, s.summary_zh, s.why_it_matters, s.org_tag, cats[0] || null, JSON.stringify(cats), JSON.stringify(s.topics || s.tags || []), s.heat ?? null, JSON.stringify(s.news_refs || []), s.data_quality || null].map(q).join(',')});`);
    for (const c of new Set(cats)) L.push(`INSERT INTO story_categories(story_id,category) VALUES (${q(s.id)},${q(c)});`);
    (s.source_posts || []).forEach((p, j) => L.push(`INSERT INTO posts(story_id,rank,handle,post_id,url,text,lang,translation_zh,likes,reposts,replies,views) VALUES (${[s.id, j + 1, p.handle, p.post_id, p.url, p.text, p.lang, p.translation_zh || p.translation, p.likes ?? null, p.reposts ?? null, p.replies ?? null, p.views ?? null].map(q).join(',')});`));
  });
  return L.join('\n') + '\n';
}

let args = process.argv.slice(2);
if (!args.length) { console.error('用法: node scripts/json2sql.js <day.json ...> | --all [dir]'); process.exit(2); }
let all = false;
if (args[0] === '--all') { all = true; const dir = args[1] || process.env.DATA_DIR || (fs.existsSync('/workspace/ai-digest/data') ? '/workspace/ai-digest/data' : path.join(__dirname, '..', 'data')); args = fs.readdirSync(dir).filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().map(f => path.join(dir, f)); }
fs.mkdirSync(OUT, { recursive: true });
const chunks = [];
for (const f of args) {
  const d = JSON.parse(fs.readFileSync(f, 'utf8')); validate(d, f);
  const sql = daySQL(d); chunks.push(sql);
  const out = path.join(OUT, d.date + '.sql'); fs.writeFileSync(out, sql);
  console.log(`OK ${out} (${d.stories.length} stories, ${d.stories.reduce((a, s) => a + (s.source_posts || []).length, 0)} posts)`);
}
if (all) { const out = path.join(OUT, 'all.sql'); fs.writeFileSync(out, chunks.join('\n')); console.log('OK ' + out); }
