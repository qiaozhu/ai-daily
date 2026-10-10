// API tests (read-only routes) against the real Worker + local in-memory D1, seeded via scripts/json2sql.js.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApi, readJSON, REAL_DAY, FIXTURE_DAY } from '../helpers/harness.mjs';

const real = readJSON(REAL_DAY);
const fixture = readJSON(FIXTURE_DAY);
let api;
before(async () => { api = await startApi(); });
after(async () => { await api?.close(); });

function assertJsonHeaders(r) {
  assert.equal(r.headers.get('content-type'), 'application/json; charset=utf-8');
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('x-frame-options'), 'DENY');
  assert.equal(r.headers.get('referrer-policy'), 'no-referrer');
  assert.match(r.headers.get('content-security-policy'), /default-src 'self'.*frame-ancestors 'none'/);
}

describe('GET /api/health', () => {
  it('returns counts of seeded data', async () => {
    const r = await api.req('/api/health');
    assert.equal(r.status, 200); assertJsonHeaders(r);
    assert.equal(r.body.ok, true);
    assert.equal(r.body.days, 3);
    assert.equal(r.body.stories, real.stories.length + 3);
    assert.equal(r.body.posts, real.stories.reduce((a, s) => a + s.source_posts.length, 0) + 3);
    assert.equal(r.body.latest, '2026-10-10');
    assert.ok(!Number.isNaN(Date.parse(r.body.time)));
  });
});

describe('GET /api/days', () => {
  it('lists days newest first with story counts', async () => {
    const r = await api.req('/api/days');
    assert.equal(r.status, 200); assertJsonHeaders(r);
    assert.equal(r.body.latest, '2026-10-10');
    assert.deepEqual(r.body.days.map(d => d.date), ['2026-10-10', '2026-10-09', '2026-10-08']);
    assert.deepEqual(r.body.days.map(d => d.story_count), [real.stories.length, 2, 1]);
    assert.equal(r.body.days[0].generated_at, real.generated_at);
    assert.equal(r.body.days[0].source, real.source);
  });
});

describe('GET /api/days/:date', () => {
  it('returns the full day in rank order, matching the source JSON', async () => {
    const r = await api.req('/api/days/2026-10-10');
    assert.equal(r.status, 200); assertJsonHeaders(r);
    assert.equal(r.body.date, real.date);
    assert.equal(r.body.timezone, 'Asia/Shanghai');
    assert.deepEqual(r.body.highlights, real.highlights);
    assert.deepEqual(r.body.data_quality_notes, real.data_quality_notes);
    assert.deepEqual(r.body.stories.map(s => s.id), real.stories.map(s => s.id));
    assert.deepEqual(r.body.stories.map(s => s.rank), real.stories.map((_, i) => i + 1));
    r.body.stories.forEach((s, i) => {
      const src = real.stories[i];
      assert.equal(s.headline_zh, src.headline_zh);
      assert.deepEqual(s.categories, src.categories);
      assert.equal(s.category, src.categories[0]);
      assert.deepEqual(s.tags, src.topics);
      assert.deepEqual(s.news_refs, src.news_refs);
      assert.equal(s.favorited, false);
      assert.deepEqual(s.source_posts.map(p => p.url), src.source_posts.map(p => p.url));
      for (const p of s.source_posts) assert.match(p.url, /^https:\/\/x\.com\/[^/]+\/status\/\d+$/);
    });
  });

  it('round-trips quotes, unicode, emoji, newlines and SQL-looking text unchanged', async () => {
    const r = await api.req('/api/days/2026-10-09');
    assert.equal(r.status, 200);
    const s = r.body.stories[0], src = fixture.stories[0];
    assert.equal(r.body.source, fixture.source);
    assert.deepEqual(r.body.highlights, fixture.highlights);
    for (const k of ['headline_zh', 'summary_zh', 'why_it_matters', 'org_tag', 'data_quality']) assert.equal(s[k], src[k], k);
    assert.equal(s.heat, 12.6);
    assert.equal(s.source_posts[0].text, src.source_posts[0].text);
    assert.equal(s.source_posts[1].translation_zh, null);
    const min = r.body.stories[1];
    assert.equal(min.why_it_matters, null); assert.equal(min.heat, null); assert.equal(min.category, null);
    assert.deepEqual(min.categories, []); assert.deepEqual(min.tags, []); assert.deepEqual(min.source_posts, []);
  });

  it('"latest" resolves to the newest day', async () => {
    const r = await api.req('/api/days/latest');
    assert.equal(r.status, 200); assert.equal(r.body.date, '2026-10-10');
  });

  it('404 for a well-formed date with no data', async () => {
    const r = await api.req('/api/days/2020-01-01');
    assert.equal(r.status, 404); assertJsonHeaders(r); assert.ok(r.body.error);
  });

  for (const bad of ['20261010', '2026-1-1', 'abc', '2026-10-10x', "2026-10-10'%20OR%201=1"]) {
    it(`400 for malformed date "${bad}"`, async () => {
      const r = await api.req('/api/days/' + bad);
      assert.equal(r.status, 400); assert.equal(r.body.error, '日期格式应为 YYYY-MM-DD');
    });
  }

  it('400 (not 500) for an invalid percent-encoding', { todo: 'BUG-1: decodeURIComponent throws -> 500 服务器错误' }, async () => {
    const r = await api.req('/api/days/%ZZ');
    assert.equal(r.status, 400);
  });

  it('nested path is not a day route (404)', async () => {
    const r = await api.req('/api/days/2026-10-10/extra');
    assert.equal(r.status, 404);
  });
});

describe('GET /api/stories (search / filters / limit)', () => {
  const ids = r => r.body.stories.map(s => s.id);

  it('no params: all stories, newest date first then rank', async () => {
    const r = await api.req('/api/stories');
    assert.equal(r.status, 200); assertJsonHeaders(r);
    assert.equal(r.body.count, real.stories.length + 3);
    assert.equal(r.body.count, r.body.stories.length);
    const keys = r.body.stories.map(s => [s.date, s.rank]);
    const sorted = [...keys].sort((a, b) => b[0].localeCompare(a[0]) || a[1] - b[1]);
    assert.deepEqual(keys, sorted);
  });

  it('q matches headline (case-insensitive)', async () => {
    const r = await api.req('/api/stories?q=' + encodeURIComponent('minimalstory'));
    assert.deepEqual(ids(r), ['2026-10-09-minimal']);
  });

  it('q matches original post text and translation', async () => {
    assert.deepEqual(ids(await api.req('/api/stories?q=uniquewordalpha')), ['2026-10-09-quotes-unicode']);
    assert.deepEqual(ids(await api.req('/api/stories?q=' + encodeURIComponent('独特词贝塔'))), ['2026-10-09-quotes-unicode']);
  });

  it('q matches handle, tags and org_tag', async () => {
    assert.deepEqual(ids(await api.req('/api/stories?q=fixture_user')), ['2026-10-09-quotes-unicode']);
    assert.deepEqual(ids(await api.req('/api/stories?q=' + encodeURIComponent('Fixture话题'))), ['2026-10-09-quotes-unicode']);
    assert.ok(ids(await api.req('/api/stories?q=' + encodeURIComponent("zeta'org"))).includes('2026-10-09-quotes-unicode'));
  });

  it('multiple terms are AND-ed', async () => {
    assert.deepEqual(ids(await api.req('/api/stories?q=' + encodeURIComponent('UNIQUEWORDALPHA 独特词贝塔'))), ['2026-10-09-quotes-unicode']);
    assert.equal((await api.req('/api/stories?q=' + encodeURIComponent('UNIQUEWORDALPHA MinimalStory'))).body.count, 0);
  });

  it('only the first 5 terms are used', async () => {
    const r = await api.req('/api/stories?q=' + encodeURIComponent('UNIQUEWORDALPHA a a a a nomatchzzzz'));
    assert.deepEqual(ids(r), ['2026-10-09-quotes-unicode']);
  });

  it('LIKE wildcards / quotes / SQL are treated literally', async () => {
    assert.deepEqual(ids(await api.req('/api/stories?q=' + encodeURIComponent('50%'))), ['2026-10-09-quotes-unicode']); // '%' is not a wildcard
    assert.equal((await api.req('/api/stories?q=' + encodeURIComponent('5_%'))).body.count, 0);
    assert.equal((await api.req('/api/stories?q=' + encodeURIComponent('under_score'))).body.count, 1);
    assert.equal((await api.req('/api/stories?q=' + encodeURIComponent("'); DROP TABLE"))).body.count, 1);
    assert.equal((await api.req('/api/stories?q=' + encodeURIComponent("' OR 1=1 --"))).body.count, 0);
    assert.equal((await api.req('/api/health')).body.stories, real.stories.length + 3); // still intact
  });

  it('whitespace-only q behaves like no q', async () => {
    assert.equal((await api.req('/api/stories?q=%20%20')).body.count, real.stories.length + 3);
  });

  it('q is capped at 100 chars (long query does not error)', async () => {
    const r = await api.req('/api/stories?q=' + 'x'.repeat(5000));
    assert.equal(r.status, 200); assert.equal(r.body.count, 0);
  });

  it('category filter', async () => {
    const r = await api.req('/api/stories?category=' + encodeURIComponent('芯片'));
    const expected = real.stories.filter(s => s.categories.includes('芯片')).map(s => s.id);
    assert.deepEqual(ids(r), expected);
    assert.ok(r.body.stories.every(s => s.categories.includes('芯片')));
    assert.equal((await api.req('/api/stories?category=nope')).body.count, 0);
  });

  it('category matches non-primary categories too', async () => {
    const r = await api.req('/api/stories?category=' + encodeURIComponent('政策'));
    assert.ok(ids(r).includes('2026-10-09-quotes-unicode')); // primary is 安全
  });

  it('from/to date range (inclusive); invalid dates are ignored', async () => {
    assert.ok((await api.req('/api/stories?from=2026-10-10')).body.stories.every(s => s.date === '2026-10-10'));
    assert.deepEqual([...new Set((await api.req('/api/stories?to=2026-10-09')).body.stories.map(s => s.date))], ['2026-10-09', '2026-10-08']);
    assert.deepEqual(ids(await api.req('/api/stories?from=2026-10-08&to=2026-10-08')), ['2026-10-08-old-openai']);
    assert.equal((await api.req('/api/stories?from=2026-10-11')).body.count, 0);
    assert.equal((await api.req('/api/stories?from=garbage&to=nope')).body.count, real.stories.length + 3);
  });

  it('filters combine (q + category + range)', async () => {
    const r = await api.req('/api/stories?q=OpenAI&category=' + encodeURIComponent('大模型') + '&to=2026-10-08');
    assert.deepEqual(ids(r), ['2026-10-08-old-openai']);
  });

  it('limit: honoured, clamped to [1,200], non-numeric -> default 100', async () => {
    assert.equal((await api.req('/api/stories?limit=3')).body.count, 3);
    assert.equal((await api.req('/api/stories?limit=-5')).body.count, 1);
    assert.equal((await api.req('/api/stories?limit=99999')).body.count, real.stories.length + 3);
    assert.equal((await api.req('/api/stories?limit=abc')).body.count, real.stories.length + 3);
    const first3 = ids(await api.req('/api/stories?limit=3'));
    assert.deepEqual(first3, ids(await api.req('/api/stories')).slice(0, 3));
  });

  it('non-integer limit does not 500', { todo: 'BUG-2: limit=1.5 -> "LIMIT 1.5" SQL error -> 500 服务器错误' }, async () => {
    const r = await api.req('/api/stories?limit=1.5');
    assert.equal(r.status, 200);
  });

  it('every story is hydrated with source_posts and favorited flag', async () => {
    const r = await api.req('/api/stories?limit=200');
    for (const s of r.body.stories) {
      assert.ok(Array.isArray(s.source_posts)); assert.equal(typeof s.favorited, 'boolean');
      for (const k of ['id', 'date', 'rank', 'headline_zh', 'categories', 'tags', 'news_refs']) assert.ok(k in s, k);
    }
  });
});

describe('GET /api/trends', () => {
  it('returns per-day / category totals / topics', async () => {
    const r = await api.req('/api/trends');
    assert.equal(r.status, 200); assertJsonHeaders(r);
    assert.deepEqual(r.body.days.map(d => [d.date, d.n]), [['2026-10-08', 1], ['2026-10-09', 2], ['2026-10-10', real.stories.length]]);
    // per_day sums == story_categories rows per date (duplicates in categories are de-duplicated)
    const sum = d => r.body.per_day.filter(x => x.date === d).reduce((a, x) => a + x.n, 0);
    assert.equal(sum('2026-10-10'), real.stories.reduce((a, s) => a + new Set(s.categories).size, 0));
    assert.equal(sum('2026-10-09'), 2); // 安全 + 政策 (dedup), minimal story has none
    const totals = r.body.category_totals;
    for (let i = 1; i < totals.length; i++) assert.ok(totals[i - 1].n >= totals[i].n, 'category_totals sorted desc');
    const expected大模型 = real.stories.filter(s => s.categories.includes('大模型')).length + 1;
    assert.equal(totals.find(t => t.category === '大模型').n, expected大模型);
  });

  it('recurring topics are those seen on >=2 days, sorted by day_count', async () => {
    const r = await api.req('/api/trends');
    const openai = r.body.topics.find(t => t.topic === 'OpenAI');
    assert.equal(openai.day_count, 3);
    assert.equal(openai.last_seen, '2026-10-10');
    assert.equal(r.body.topics[0].topic, 'OpenAI');
    assert.ok(r.body.recurring_topics.every(t => t.day_count >= 2));
    assert.ok(r.body.recurring_topics.some(t => t.topic === 'OpenAI'));
    assert.ok(!r.body.recurring_topics.some(t => t.topic === 'Fixture话题'));
    for (let i = 1; i < r.body.topics.length; i++) assert.ok(r.body.topics[i - 1].day_count >= r.body.topics[i].day_count);
    for (const t of r.body.topics) assert.equal(t.heat_sum, Math.round(t.heat_sum));
  });
});

describe('GET /api/export', () => {
  it('downloads all days + favorites as an attachment', async () => {
    const r = await api.req('/api/export');
    assert.equal(r.status, 200); assertJsonHeaders(r);
    assert.equal(r.headers.get('content-disposition'), 'attachment; filename="ai-daily-export-2026-10-10.json"');
    assert.deepEqual(r.body.days.map(d => d.date), ['2026-10-10', '2026-10-09', '2026-10-08']);
    assert.ok(Array.isArray(r.body.favorites));
    const s = r.body.days[0].stories[0];
    assert.deepEqual(s.topics, real.stories[0].topics);
    assert.ok(!('favorited' in s));
    assert.equal(r.body.days[0].stories.length, real.stories.length);
    assert.deepEqual(r.body.days[1].highlights, fixture.highlights);
  });
});

describe('unknown routes / methods', () => {
  it('unknown GET /api/* -> 404 JSON', async () => {
    const r = await api.req('/api/nope');
    assert.equal(r.status, 404); assertJsonHeaders(r); assert.equal(r.body.error, 'not found');
  });
  it('/api/ingest POST -> 405 (no public ingest endpoint)', async () => {
    const r = await api.req('/api/ingest', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } });
    assert.equal(r.status, 405); assert.equal(r.body.error, 'method not allowed');
  });
  for (const [m, p] of [['POST', '/api/days'], ['PUT', '/api/favorites'], ['DELETE', '/api/stories'], ['PATCH', '/api/export'], ['POST', '/api/favorites/x'], ['GET', '/api/favorites/x']]) {
    it(`${m} ${p} -> ${m === 'GET' ? 404 : 405}`, async () => {
      const r = await api.req(p, { method: m });
      assert.equal(r.status, m === 'GET' ? 404 : 405);
    });
  }
  it('HEAD on a GET API route is allowed', { todo: 'MINOR-1: HEAD /api/days -> 405（HTTP 语义上 HEAD 应与 GET 一致）' }, async () => {
    const r = await api.req('/api/days', { method: 'HEAD' });
    assert.equal(r.status, 200);
  });
});

describe('static assets (Workers Static Assets via ASSETS binding)', () => {
  it('index.html is served with security headers added by the Worker', async () => {
    const r = await api.req('/');
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type'), /text\/html/);
    assert.match(r.text, /<html/i);
    assert.equal(r.headers.get('x-frame-options'), 'DENY');
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.match(r.headers.get('content-security-policy'), /script-src 'self'/);
  });
  for (const f of ['app.js', 'style.css', 'theme.js']) {
    it(`/${f} is served`, async () => {
      const r = await api.req('/' + f);
      assert.equal(r.status, 200);
      assert.match(r.headers.get('content-type'), f.endsWith('.css') ? /text\/css/ : /javascript/);
    });
  }
  it('/favicon.ico -> 204', async () => {
    assert.equal((await api.req('/favicon.ico')).status, 204);
  });
  it('missing asset -> 404 with security headers', async () => {
    const r = await api.req('/definitely-missing.png');
    assert.equal(r.status, 404); assert.equal(r.headers.get('x-frame-options'), 'DENY');
  });
});
