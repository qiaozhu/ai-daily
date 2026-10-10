// F2 (#9): story detail APIs (/api/stories/:id[/trend|/related]), the /story/<id> page with og tags,
// og tags on /day/<date>, and the share-card image routes /og/{day,story}/<x>.png (KV CARDS -> default image -> 404).
// Black-box: requests go through the real Worker (wrangler test harness, local D1 + KV + assets).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startApi, SEED_FILES } from '../helpers/harness.mjs';

// extra report days: "Sora 9" runs 09-01, 09-02, (gap) 09-04; 09-04 also has a story that appears for the first time
const story = (id, o = {}) => ({
  id, headline_zh: `标题 ${id}`, summary_zh: `摘要 ${id}`, why_it_matters: '原因', org_tag: 'OrgA',
  categories: ['模型'], topics: [], heat: 10, source_posts: [], news_refs: [], data_quality: null, ...o,
});
const day = (date, stories) => ({
  date, generated_at: `${date}T10:00:00+08:00`, timezone: 'Asia/Shanghai', source: 'test',
  highlights: [`${date} 要点一`, '要点二 & <b>'], stories, data_quality_notes: [],
});
const EXTRA = [
  day('2026-09-01', [story('2026-09-01-sora', { topics: ['Sora 9'], heat: 30 }), story('2026-09-01-other', { topics: ['Other'], heat: 5 })]),
  day('2026-09-02', [
    story('2026-09-02-sora-a', { topics: ['Sora 9'], heat: 20 }),
    story('2026-09-02-sora-b', { topics: ['SORA 9', 'Veo'], heat: 45 }),
  ]),
  day('2026-09-04', [
    story('2026-09-04-sora', { topics: ['Sora 9', 'OpenAI'], heat: 50, headline_zh: '<Sora> & "9" 发布' }),
    story('2026-09-04-fresh', { topics: ['全新话题'], org_tag: 'OrgB', heat: 8 }),
    story('2026-09-04-orgonly', { topics: ['OpenAI'], org_tag: 'OrgB', heat: 7 }),
  ]),
];

let api, tmp;
before(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-daily-story-'));
  const files = EXTRA.map((d) => {
    const f = path.join(tmp, `${d.date}.json`);
    fs.writeFileSync(f, JSON.stringify(d));
    return f;
  });
  api = await startApi({ seedFiles: [...files, ...SEED_FILES] });
});
after(async () => {
  await api?.close();
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
});

const get = (p, init = {}) => api.req(p, { redirect: 'manual', ...init });
const raw = async (p, init = {}) => {
  const res = await api.server.fetch(p, { redirect: 'manual', ...init });
  const buf = new Uint8Array(await res.arrayBuffer());
  return { status: res.status, headers: res.headers, buf };
};
const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const isPng = (buf) => PNG_SIG.every((b, i) => buf[i] === b);
const meta = (html, prop) => {
  const m = new RegExp(`<meta (?:property|name)="${prop.replace(/[:]/g, '\\$&')}" content="([^"]*)"`).exec(html);
  return m ? m[1] : null;
};

describe('GET /api/stories/:id', () => {
  it('existing story -> full story + badge + streak_days', async () => {
    const r = await get('/api/stories/2026-09-04-sora');
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type'), /application\/json/);
    assert.equal(r.body.id, '2026-09-04-sora');
    assert.equal(r.body.date, '2026-09-04');
    assert.equal(r.body.headline_zh, '<Sora> & "9" 发布');
    for (const k of ['summary_zh', 'why_it_matters', 'org_tag', 'categories', 'tags', 'heat', 'source_posts', 'news_refs', 'badge', 'streak_days'])
      assert.ok(k in r.body, k);
    assert.equal(r.body.badge, 'ongoing', 'days without a report (09-03) are skipped, same as the F1 badges');
    assert.equal(r.body.streak_days, 3);
  });
  it('fixture story keeps its posts and fields', async () => {
    const r = await get('/api/stories/2026-10-09-quotes-unicode');
    assert.equal(r.status, 200);
    assert.equal(r.body.source_posts.length, 2);
    assert.equal(r.body.org_tag, "Zeta'Org");
  });
  it('consecutive days -> badge with streak_days', async () => {
    const r = await get('/api/stories/2026-09-02-sora-b');
    assert.equal(r.status, 200);
    assert.equal(r.body.streak_days, 2);
    assert.ok(r.body.badge);
  });
  it('encoded id works', async () => {
    const r = await get('/api/stories/' + encodeURIComponent('2026-09-04-sora'));
    assert.equal(r.status, 200);
  });
  for (const p of [
    '/api/stories/2026-09-04-nope', '/api/stories/nope', '/api/stories/%ZZ', '/api/stories/2026-02-30-x',
    '/api/stories/2026-09-04-sora/', '/api/stories/2026-09-04-sora/unknown', '/api/stories/2026-09-04-sora/trend/x',
    '/api/stories/2026-09-04-nope/trend', '/api/stories/2026-09-04-nope/related',
  ]) {
    it(`${p} -> JSON 404`, async () => {
      const r = await get(p);
      assert.equal(r.status, 404);
      assert.match(r.headers.get('content-type'), /application\/json/);
      assert.equal(typeof r.body.error, 'string');
    });
  }
  it('existing list endpoint /api/stories is unchanged', async () => {
    const r = await get('/api/stories?date=2026-10-10');
    assert.equal(r.status, 200);
  });
});

describe('GET /api/stories/:id/trend', () => {
  it('matched days, max heat per day, missing days skipped, ascending', async () => {
    const r = await get('/api/stories/2026-09-04-sora/trend');
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.points, [
      { date: '2026-09-01', heat: 30, story_id: '2026-09-01-sora' },
      { date: '2026-09-02', heat: 45, story_id: '2026-09-02-sora-b' },
      { date: '2026-09-04', heat: 50, story_id: '2026-09-04-sora' },
    ]);
  });
  it('later days are not included (window ends at the story date)', async () => {
    const r = await get('/api/stories/2026-09-01-sora/trend');
    assert.deepEqual(r.body.points.map((p) => p.date), ['2026-09-01']);
  });
  it('first appearance -> a single point', async () => {
    const r = await get('/api/stories/2026-09-04-fresh/trend');
    assert.deepEqual(r.body.points, [{ date: '2026-09-04', heat: 8, story_id: '2026-09-04-fresh' }]);
  });
  it('story without heat -> heat null', async () => {
    const r = await get('/api/stories/2026-10-09-minimal/trend');
    assert.equal(r.status, 200);
    assert.equal(r.body.points.length, 1);
    assert.equal(r.body.points[0].heat, null);
  });
});

describe('GET /api/stories/:id/related', () => {
  it('shared specific topics, one per event, <= 5, fields', async () => {
    const r = await get('/api/stories/2026-09-04-sora/related');
    assert.equal(r.status, 200);
    assert.ok(r.body.stories.length <= 5);
    const ids = r.body.stories.map((s) => s.id);
    assert.ok(ids.includes('2026-09-02-sora-b') || ids.includes('2026-09-02-sora-a'));
    assert.ok(!ids.includes('2026-09-04-sora'), 'not itself');
    assert.ok(!ids.includes('2026-09-04-orgonly'), '"OpenAI" alone is a blacklisted (broad) topic');
    for (const s of r.body.stories) {
      assert.deepEqual(Object.keys(s).sort(), ['date', 'headline_zh', 'heat', 'id', 'shared_topics']);
      assert.ok(s.shared_topics.length >= 1);
    }
  });
  it('no specific topic -> same org in the last 7 days', async () => {
    const r = await get('/api/stories/2026-09-04-orgonly/related');
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.stories.map((s) => s.id), ['2026-09-04-fresh']);
    assert.deepEqual(r.body.stories[0].shared_topics, []);
  });
  it('nothing related -> empty list', async () => {
    const r = await get('/api/stories/2026-10-09-minimal/related');
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.stories, []);
  });
});

describe('/story/<id> page', () => {
  it('existing story -> 200 shell with og tags (escaped)', async () => {
    const r = await get('/story/2026-09-04-sora');
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type'), /text\/html/);
    assert.match(r.text, /<div id="root">/);
    assert.equal(meta(r.text, 'og:title'), '&lt;Sora&gt; &amp; &quot;9&quot; 发布');
    assert.equal(meta(r.text, 'og:description'), '摘要 2026-09-04-sora');
    assert.match(meta(r.text, 'og:url'), /^https?:\/\/[^/]+\/story\/2026-09-04-sora$/);
    assert.match(meta(r.text, 'og:image'), /^https?:\/\/[^/]+\/og\/story\/2026-09-04-sora\.png$/);
    assert.equal(meta(r.text, 'og:type'), 'article');
    assert.equal(meta(r.text, 'og:image:width'), '1200');
    assert.equal(meta(r.text, 'og:image:height'), '630');
    assert.equal(meta(r.text, 'twitter:card'), 'summary_large_image');
    assert.match(r.text, /<title>&lt;Sora&gt; &amp; "9" 发布 · AI 热点日报<\/title>/);
    assert.equal((r.text.match(/<title>/g) || []).length, 1);
    assert.equal(r.headers.get('x-frame-options'), 'DENY');
  });
  it('og:image URL of the page resolves to a PNG', async () => {
    const r = await get('/story/2026-10-10-claude-dashboards-motion');
    const img = new URL(meta(r.text, 'og:image'));
    const i = await raw(img.pathname);
    assert.equal(i.status, 200);
    assert.equal(i.headers.get('content-type'), 'image/png');
    assert.ok(isPng(i.buf));
  });
  for (const p of ['/story/2026-09-04-nope', '/story/nope', '/story/%ZZ', '/story/2026-09-04-sora/x', '/story/']) {
    it(`${p} -> 404 page without og tags`, async () => {
      const r = await get(p);
      assert.equal(r.status, 404);
      assert.match(r.headers.get('content-type'), /text\/html/);
      assert.match(r.text, /<div id="root">/);
      assert.doesNotMatch(r.text, /property="og:|name="twitter:/);
      assert.equal(r.headers.get('cache-control'), 'no-store');
    });
  }
});

describe('/day/<date> og tags', () => {
  it('existing report -> og tags with the day card', async () => {
    const r = await get('/day/2026-09-04');
    assert.equal(r.status, 200);
    assert.equal(meta(r.text, 'og:title'), '9月4日 AI 热点 · AI 热点日报');
    assert.equal(meta(r.text, 'og:description'), '2026-09-04 要点一；要点二 &amp; &lt;b&gt;');
    assert.match(meta(r.text, 'og:image'), /\/og\/day\/2026-09-04\.png$/);
    assert.match(meta(r.text, 'og:url'), /\/day\/2026-09-04$/);
    assert.equal(meta(r.text, 'twitter:card'), 'summary_large_image');
  });
  it('existing day/story pages: short HTML cache, no static ETag', async () => {
    for (const p of ['/day/2026-09-04', '/story/2026-09-04-sora']) {
      const r = await get(p);
      assert.equal(r.headers.get('cache-control'), 'public, max-age=300', p);
      assert.equal(r.headers.get('etag'), null, p);
    }
  });
  it('conditional request does not get a 304 for the static file', async () => {
    const first = await get('/index.html');
    const etag = first.headers.get('etag');
    const r = await get('/day/2026-09-04', { headers: etag ? { 'If-None-Match': etag } : {} });
    assert.equal(r.status, 200);
    assert.match(r.text, /og:image/);
  });
});

describe('og tags on the other pages (PRD #26)', () => {
  it('`/` -> the latest day: og:image /og/day/<latest>.png, short cache', async () => {
    const r = await get('/');
    assert.equal(r.status, 200);
    assert.match(r.text, /<div id="root">/);
    assert.equal(meta(r.text, 'og:title'), 'AI 热点日报');
    assert.match(meta(r.text, 'og:image'), /^https?:\/\/[^/]+\/og\/day\/2026-10-10\.png$/);
    assert.match(meta(r.text, 'og:url'), /^https?:\/\/[^/]+\/$/);
    assert.equal(meta(r.text, 'twitter:card'), 'summary_large_image');
    assert.equal(r.headers.get('cache-control'), 'public, max-age=300');
    assert.equal((r.text.match(/property="og:image"/g) || []).length, 1);
  });
  it('`/?d=<bad>` is still a 200 shell (the front end replaces it with /day/<value>)', async () => {
    for (const v of ['2000-01-01', 'abc']) {
      const r = await get('/?d=' + v);
      assert.equal(r.status, 200);
      assert.equal((await get('/day/' + v)).status, 404);
    }
  });
  for (const [p, title] of [['/search', '搜索 · AI 热点日报'], ['/archive', '往期 · AI 热点日报'], ['/me', '我的 · AI 热点日报']]) {
    it(`${p} -> static default image`, async () => {
      const r = await get(p + (p === '/archive' ? '?tab=trend' : ''));
      assert.equal(r.status, 200);
      assert.equal(meta(r.text, 'og:title'), title);
      assert.match(meta(r.text, 'og:image'), /^https?:\/\/[^/]+\/og\/default-og\.png$/);
      assert.match(meta(r.text, 'og:url'), new RegExp(p.replace('/', '\\/') + '$'));
      assert.equal(meta(r.text, 'twitter:card'), 'summary_large_image');
      assert.equal(r.headers.get('cache-control'), 'public, max-age=300');
      const img = await raw(new URL(meta(r.text, 'og:image')).pathname);
      assert.equal(img.status, 200);
      assert.equal(img.headers.get('content-type'), 'image/png');
    });
  }
});

describe('/og/{day,story}/<x>.png share cards', () => {
  const KEY = 'card/story/2026-10-10-xai-grok-bot/og.png';
  const CARD = new Uint8Array([...PNG_SIG, 1, 2, 3, 4]);
  before(async () => {
    await api.env.CARDS.put(KEY, CARD);
    await api.env.CARDS.put('card/day/2026-10-10/save.png', CARD);
  });

  it('exists + card in KV -> that card, long cache', async () => {
    const r = await raw('/og/story/2026-10-10-xai-grok-bot.png');
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-type'), 'image/png');
    assert.deepEqual([...r.buf], [...CARD]);
    assert.match(r.headers.get('cache-control'), /max-age=604800/);
  });
  it('?size=portrait reads the save card', async () => {
    const r = await raw('/og/day/2026-10-10.png?size=portrait');
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-type'), 'image/png');
    assert.deepEqual([...r.buf], [...CARD]);
  });
  it('exists, no card -> default brand image (1200x630), 200, short cache', async () => {
    for (const p of ['/og/day/2026-10-09.png', '/og/story/2026-10-09-minimal.png', '/og/day/2026-10-10.png']) {
      const r = await raw(p);
      assert.equal(r.status, 200, p);
      assert.equal(r.headers.get('content-type'), 'image/png');
      assert.ok(isPng(r.buf), p);
      const view = new DataView(r.buf.buffer);
      assert.deepEqual([view.getUint32(16), view.getUint32(20)], [1200, 630], p);
      assert.equal(r.headers.get('cache-control'), 'public, max-age=300');
    }
  });
  it('exists, no card, ?size=portrait -> default portrait (1080x1440)', async () => {
    const r = await raw('/og/story/2026-09-04-fresh.png?size=portrait');
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-type'), 'image/png');
    const view = new DataView(r.buf.buffer);
    assert.deepEqual([view.getUint32(16), view.getUint32(20)], [1080, 1440]);
    assert.equal(r.headers.get('cache-control'), 'public, max-age=300');
  });
  for (const p of [
    '/og/day/2000-01-01.png', '/og/day/2026-02-30.png', '/og/day/abc.png', '/og/story/2026-09-04-nope.png',
    '/og/story/nope.png', '/og/story/%ZZ.png', '/og/day/2026-10-10.jpg', '/og/story/2026-09-04-nope.png?size=portrait',
  ]) {
    it(`${p} -> 404, not an image`, async () => {
      const r = await raw(p);
      assert.equal(r.status, 404);
      assert.doesNotMatch(r.headers.get('content-type') || '', /image|text\/html/);
      assert.equal(r.headers.get('cache-control'), 'no-store');
    });
  }
  it('default images are also plain static files', async () => {
    for (const p of ['/og/default-og.png', '/og/default-portrait.png']) {
      const r = await raw(p);
      assert.equal(r.status, 200, p);
      assert.equal(r.headers.get('content-type'), 'image/png');
    }
  });
});
