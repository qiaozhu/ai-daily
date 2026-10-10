// Unit tests for scripts/json2sql.js (run as a CLI in a temp sandbox; SQL executed in node:sqlite with the real migration).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { sandbox, minimalDay, ROOT } from '../helpers/json2sql.mjs';

const MIGRATION = fs.readFileSync(path.join(ROOT, 'migrations', '0001_init.sql'), 'utf8');
const freshDb = () => { const db = new DatabaseSync(':memory:'); db.exec('PRAGMA foreign_keys=ON;'); db.exec(MIGRATION); return db; };
const rows = (db, sql, ...a) => db.prepare(sql).all(...a).map(r => ({ ...r }));
const one = (db, sql, ...a) => rows(db, sql, ...a)[0];

let sb;
before(() => { sb = sandbox(); });
after(() => sb.cleanup());

/** write day(s), run the CLI on them, return {r, sql} */
function convert(day, name = day.date + '.json') {
  const f = sb.write(name, day);
  const r = sb.run([f]);
  return { r, sql: r.status === 0 ? sb.sql(day.date + '.sql') : null };
}

describe('json2sql CLI basics', () => {
  it('no args -> usage, exit 2', () => {
    const r = sb.run([]);
    assert.equal(r.status, 2); assert.match(r.stderr, /用法/);
  });

  it('single file -> sql/<date>.sql and summary line', () => {
    const { r, sql } = convert(minimalDay('2026-01-01'));
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /OK .*2026-01-01\.sql \(1 stories, 1 posts\)/);
    assert.match(sql, /^-- ===== day 2026-01-01 \(1 stories\) =====/);
    assert.doesNotMatch(sql, /\b(BEGIN|COMMIT)\b/, 'D1 rejects explicit transactions');
  });

  it('--all <dir> converts only YYYY-MM-DD.json files, sorted, into all.sql', () => {
    const s = sandbox();
    try {
      s.write('2026-02-02.json', minimalDay('2026-02-02'));
      s.write('2026-02-01.json', minimalDay('2026-02-01'));
      s.write('notes.json', '{not even json');
      s.write('2026-2-3.json', '{}');
      const r = s.run(['--all', s.dataDir]);
      assert.equal(r.status, 0, r.stderr);
      const all = s.sql('all.sql');
      assert.ok(all.indexOf('day 2026-02-01') < all.indexOf('day 2026-02-02'));
      assert.ok(s.hasSql('2026-02-01.sql') && s.hasSql('2026-02-02.sql'));
      assert.equal((all.match(/===== day/g) || []).length, 2);
    } finally { s.cleanup(); }
  });

  it('repo data/ converts cleanly (same as npm run check)', () => {
    const s = sandbox();
    try {
      const r = s.run(['--all', path.join(ROOT, 'data')]);
      assert.equal(r.status, 0, r.stderr);
      const db = freshDb(); db.exec(s.sql('all.sql'));
      for (const f of fs.readdirSync(path.join(ROOT, 'data')).filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))) {
        const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', f), 'utf8'));
        assert.equal(one(db, 'SELECT count(*) n FROM stories WHERE date=?', d.date).n, d.stories.length);
      }
    } finally { s.cleanup(); }
  });
});

describe('SQL escaping & value mapping (executed in SQLite)', () => {
  const nasty = [
    "O'Reilly", "''", "'; DROP TABLE favorites; --", '"double" quotes', 'back\\slash \\\' mix', 'new\nline\r\ntabs\t',
    '中文「引号」，标点。', '🚀👩‍💻 emoji ZWJ', 'percent % and under_score', '\u2028\u2029 separators', 'null', 'NULL', '\u00e9\u0301 combining',
  ];
  let db, day;
  before(() => {
    day = minimalDay('2026-03-01', { source: nasty.join(' | '), highlights: nasty, data_quality_notes: ["it's"] });
    day.stories = nasty.map((t, i) => ({
      id: `2026-03-01-s${i}-${t}`, headline_zh: t, summary_zh: t + ' summary', why_it_matters: t, org_tag: t,
      categories: [t, '大模型'], topics: [t], heat: i + 0.5, news_refs: [t], data_quality: t,
      source_posts: [{ handle: t, post_id: String(i), url: 'https://x.com/u/status/' + i, text: t, lang: 'zh', translation_zh: t, likes: i, reposts: null, replies: 0, views: 1e9 }],
    }));
    const { r, sql } = convert(day);
    assert.equal(r.status, 0, r.stderr);
    db = freshDb(); db.exec(sql);
  });

  it('every string round-trips byte-for-byte', () => {
    const got = rows(db, 'SELECT id, headline_zh, summary_zh, why_it_matters, org_tag, data_quality FROM stories ORDER BY rank');
    assert.equal(got.length, nasty.length);
    got.forEach((s, i) => {
      assert.equal(s.id, day.stories[i].id);
      assert.equal(s.headline_zh, nasty[i]); assert.equal(s.summary_zh, nasty[i] + ' summary');
      assert.equal(s.why_it_matters, nasty[i]); assert.equal(s.org_tag, nasty[i]); assert.equal(s.data_quality, nasty[i]);
    });
    const posts = rows(db, 'SELECT handle, text, translation_zh FROM posts ORDER BY id');
    posts.forEach((p, i) => assert.deepEqual([p.handle, p.text, p.translation_zh], [nasty[i], nasty[i], nasty[i]]));
  });

  it('JSON columns hold valid JSON with the original values', () => {
    const d = one(db, 'SELECT * FROM days');
    assert.equal(d.source, nasty.join(' | '));
    assert.deepEqual(JSON.parse(d.highlights_json), nasty);
    assert.deepEqual(JSON.parse(d.data_quality_json), ["it's"]);
    rows(db, 'SELECT categories_json, tags_json, news_refs_json FROM stories ORDER BY rank').forEach((s, i) => {
      assert.deepEqual(JSON.parse(s.categories_json), [nasty[i], '大模型']);
      assert.deepEqual(JSON.parse(s.tags_json), [nasty[i]]);
      assert.deepEqual(JSON.parse(s.news_refs_json), [nasty[i]]);
    });
  });

  it('SQL-injection-looking content did not execute (tables intact)', () => {
    const tables = rows(db, "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").map(r => r.name);
    for (const t of ['days', 'favorites', 'posts', 'stories', 'story_categories']) assert.ok(tables.includes(t), t);
  });

  it('numbers / nulls: heat & metrics kept, null -> NULL', () => {
    const p = one(db, 'SELECT likes, reposts, replies, views FROM posts ORDER BY id LIMIT 1 OFFSET 3');
    assert.deepEqual(p, { likes: 3, reposts: null, replies: 0, views: 1e9 });
    assert.equal(one(db, 'SELECT heat FROM stories WHERE rank=2').heat, 1.5);
  });

  it('rank follows array order; posts ranked per story; primary category = first', () => {
    assert.deepEqual(rows(db, 'SELECT rank FROM stories ORDER BY rank').map(r => r.rank), nasty.map((_, i) => i + 1));
    assert.equal(one(db, 'SELECT category FROM stories WHERE rank=1').category, nasty[0]);
    assert.equal(one(db, 'SELECT count(*) n FROM story_categories').n, nasty.length * 2);
  });
});

describe('field defaults & fallbacks', () => {
  let db;
  before(() => {
    const day = minimalDay('2026-04-01');
    delete day.timezone; delete day.highlights; delete day.data_quality_notes; delete day.generated_at;
    day.stories = [
      { id: 'a', headline_zh: 'A', summary_zh: 'a', categories: ['芯片', '芯片', '政策'], tags: ['legacyTag'],
        source_posts: [{ handle: 'h', url: 'https://x.com/h/status/1', translation: 'legacy translation' }] },
      { id: 'b', headline_zh: 'B', summary_zh: 'b' },
    ];
    const { r, sql } = convert(day);
    assert.equal(r.status, 0, r.stderr);
    db = freshDb(); db.exec(sql);
  });
  it('timezone defaults to Asia/Shanghai; highlights/notes default to []', () => {
    const d = one(db, 'SELECT * FROM days');
    assert.equal(d.timezone, 'Asia/Shanghai'); assert.equal(d.highlights_json, '[]'); assert.equal(d.data_quality_json, '[]');
    assert.equal(d.generated_at, null); assert.ok(!Number.isNaN(Date.parse(d.imported_at)));
  });
  it('legacy "tags" and "translation" keys are accepted', () => {
    assert.equal(one(db, "SELECT tags_json FROM stories WHERE id='a'").tags_json, '["legacyTag"]');
    assert.equal(one(db, 'SELECT translation_zh FROM posts').translation_zh, 'legacy translation');
  });
  it('duplicate categories are de-duplicated in story_categories', () => {
    assert.deepEqual(rows(db, "SELECT category FROM story_categories WHERE story_id='a' ORDER BY category").map(r => r.category), ['政策', '芯片']);
  });
  it('missing optional fields become NULL / []', () => {
    const b = one(db, "SELECT * FROM stories WHERE id='b'");
    assert.deepEqual([b.category, b.heat, b.why_it_matters, b.org_tag, b.data_quality, b.categories_json, b.tags_json, b.news_refs_json],
      [null, null, null, null, null, '[]', '[]', '[]']);
  });
});

describe('idempotent re-import', () => {
  it('running the same SQL twice gives the same rows; favorites and other days untouched', () => {
    const db = freshDb();
    const d1 = minimalDay('2026-05-01'), d2 = minimalDay('2026-05-02');
    const s1 = convert(d1).sql, s2 = convert(d2).sql;
    db.exec(s1); db.exec(s2);
    db.exec(`INSERT INTO favorites VALUES ('2026-05-01-a', '2026-05-01T00:00:00Z')`);
    const snap = () => rows(db, 'SELECT (SELECT count(*) FROM days) d, (SELECT count(*) FROM stories) s, (SELECT count(*) FROM posts) p, (SELECT count(*) FROM story_categories) c, (SELECT count(*) FROM favorites) f')[0];
    const before = snap();
    db.exec(s1); db.exec(s1);
    assert.deepEqual(snap(), before);
    assert.deepEqual(before, { d: 2, s: 2, p: 2, c: 2, f: 1 });
  });

  it('a story dropped from a day is removed on re-import; edits are applied', () => {
    const db = freshDb();
    const d = minimalDay('2026-05-03');
    d.stories.push({ ...d.stories[0], id: '2026-05-03-b', headline_zh: 'B' });
    db.exec(convert(d).sql);
    assert.equal(one(db, 'SELECT count(*) n FROM stories').n, 2);
    d.stories = [{ ...d.stories[1], headline_zh: 'B2' }];
    db.exec(convert(d).sql);
    assert.deepEqual(rows(db, 'SELECT id, headline_zh, rank FROM stories'), [{ id: '2026-05-03-b', headline_zh: 'B2', rank: 1 }]);
    assert.equal(one(db, 'SELECT count(*) n FROM posts').n, 1);
  });

  it('a story id moved to another date is removed from the old date', () => {
    const db = freshDb();
    const a = minimalDay('2026-05-04'); a.stories[0].id = 'moving';
    const b = minimalDay('2026-05-05'); b.stories[0].id = 'moving';
    db.exec(convert(a).sql); db.exec(convert(b).sql);
    assert.deepEqual(rows(db, 'SELECT id, date FROM stories'), [{ id: 'moving', date: '2026-05-05' }]);
    assert.equal(one(db, 'SELECT count(*) n FROM posts').n, 1);
  });
});

describe('validation & malformed input (non-zero exit, no SQL written)', () => {
  const cases = [
    ['missing date', d => { delete d.date; }, /date 缺失或格式错误/],
    ['bad date format', d => { d.date = '2026/06/01'; }, /date 缺失或格式错误/],
    ['empty stories', d => { d.stories = []; }, /stories 为空/],
    // not a friendly message (crashes with TypeError) but still exits non-zero without writing SQL
    ['stories not an array', d => { d.stories = {}; }, /stories 为空|TypeError/],
    ['story missing id', d => { delete d.stories[0].id; }, /缺少 id/],
    ['story missing headline_zh', d => { d.stories[0].headline_zh = ''; }, /缺少 headline_zh/],
    ['story missing summary_zh', d => { delete d.stories[0].summary_zh; }, /缺少 summary_zh/],
    ['duplicate story id', d => { d.stories.push({ ...d.stories[0] }); }, /重复 id/],
    ['post missing handle', d => { delete d.stories[0].source_posts[0].handle; }, /缺少 handle/],
    ['post url not x.com', d => { d.stories[0].source_posts[0].url = 'https://twitter.com/u/status/1'; }, /url 非 x\.com/],
    ['post url http', d => { d.stories[0].source_posts[0].url = 'http://x.com/u/status/1'; }, /url 非 x\.com/],
  ];
  for (const [name, mutate, re] of cases) {
    it(name, () => {
      const s = sandbox();
      try {
        const d = minimalDay('2026-06-01'); mutate(d);
        const f = s.write('2026-06-01.json', d);
        const r = s.run([f]);
        assert.notEqual(r.status, 0); assert.match(r.stderr, re);
        assert.ok(!s.hasSql('2026-06-01.sql'));
      } finally { s.cleanup(); }
    });
  }

  it('lookalike host https://x.com.evil.example/ is rejected', () => {
    const s = sandbox();
    try {
      const d = minimalDay('2026-06-01'); d.stories[0].source_posts[0].url = 'https://x.com.evil.example/u';
      const r = s.run([s.write('2026-06-01.json', d)]);
      assert.notEqual(r.status, 0);
    } finally { s.cleanup(); }
  });

  it('file name must match the date field', () => {
    const s = sandbox();
    try {
      const r = s.run([s.write('2026-06-02.json', minimalDay('2026-06-01'))]);
      assert.notEqual(r.status, 0); assert.match(r.stderr, /文件名与 date 不一致/);
    } finally { s.cleanup(); }
  });

  it('reports all errors at once', () => {
    const s = sandbox();
    try {
      const d = minimalDay('2026-06-01'); delete d.stories[0].id; delete d.stories[0].summary_zh;
      const r = s.run([s.write('2026-06-01.json', d)]);
      assert.match(r.stderr, /缺少 id[\s\S]*缺少 summary_zh/);
    } finally { s.cleanup(); }
  });

  for (const [name, raw] of [['malformed JSON', '{"date": "2026-06-01", '], ['empty file', ''], ['JSON null', 'null'], ['JSON array', '[]']]) {
    it(name + ' -> non-zero exit', () => {
      const s = sandbox();
      try {
        const r = s.run([s.write('2026-06-01.json', raw)]);
        assert.notEqual(r.status, 0); assert.ok(!s.hasSql('2026-06-01.sql'));
      } finally { s.cleanup(); }
    });
  }

  it('--all: one bad file fails the whole run and all.sql is not written', () => {
    const s = sandbox();
    try {
      s.write('2026-06-01.json', minimalDay('2026-06-01'));
      s.write('2026-06-02.json', '{oops');
      const r = s.run(['--all', s.dataDir]);
      assert.notEqual(r.status, 0); assert.ok(!s.hasSql('all.sql'));
    } finally { s.cleanup(); }
  });

  it('impossible calendar dates are rejected', { todo: 'MINOR-2: json2sql 的 isDate 只校验 \\d{4}-\\d{2}-\\d{2}，2026-13-45 会被接受（API 的 isDate 同理）' }, () => {
    const s = sandbox();
    try {
      const r = s.run([s.write('2026-13-45.json', minimalDay('2026-13-45'))]);
      assert.notEqual(r.status, 0);
    } finally { s.cleanup(); }
  });
});
