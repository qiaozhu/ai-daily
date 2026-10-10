// v6 cross-day badges (PRD v6 §3.1 / §3.2): `badge` + `streak_days` are NEW fields on the stories of
// /api/days/:date; every legacy field stays as it was. Seeds its own multi-day fixtures (PRD acceptance examples).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startApi } from '../helpers/harness.mjs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aidaily-badges-'));
const post = id => ({ handle: 'tester', post_id: String(1846000000000000000n + BigInt(id)), url: `https://x.com/tester/status/${1846000000000000000n + BigInt(id)}`, text: 't', lang: 'en', translation_zh: '译', likes: 1, reposts: 1, replies: 1, views: 1 });
let seq = 0;
const story = (date, slug, topics, heat = 50) => ({
  id: `${date}-${slug}`, headline_zh: slug, summary_zh: 's', why_it_matters: 'w', org_tag: 'Org',
  categories: ['产品'], topics, heat, news_refs: [], data_quality: null, source_posts: [post(++seq)],
});
const day = (date, stories) => ({ date, generated_at: `${date}T08:50:00+08:00`, timezone: 'Asia/Shanghai', source: 'test', highlights: ['a', 'b', 'c', 'd'], stories, data_quality_notes: [] });
const write = d => { const f = path.join(dir, d.date + '.json'); fs.writeFileSync(f, JSON.stringify(d)); return f; };

// 09-01..09-03: Codex every day (example 1)        09-05 (09-04 has no report): Codex again -> skip the gap (example 2)
// 09-06: report without Codex; 09-07: Codex -> N=1, seen within 30 days -> no badge (example 3)
// 09-07 also: broad-only topics (example 4) and 马斯克 in 3 stories (example 5)
const files = [
  day('2026-09-01', [story('2026-09-01', 'codex', ['Codex', 'OpenAI'], 40), story('2026-09-01', 'musk', ['马斯克'])]),
  day('2026-09-02', [story('2026-09-02', 'codex', ['Codex'], 55)]),
  day('2026-09-03', [story('2026-09-03', 'codex', ['codex', 'GPT-6'], 60)]),
  day('2026-09-05', [story('2026-09-05', 'codex', ['Codex'])]),
  day('2026-09-06', [story('2026-09-06', 'other', ['别的事'])]),
  day('2026-09-07', [
    story('2026-09-07', 'codex', ['Codex']),
    story('2026-09-07', 'broad', ['OpenAI', '大模型']),
    story('2026-09-07', 'm1', ['马斯克', 'Grok']),
    story('2026-09-07', 'm2', ['马斯克', '特朗普']),
    story('2026-09-07', 'm3', ['马斯克', 'SpaceX']),
  ]),
].map(write);

let api;
before(async () => { api = await startApi({ seedFiles: files }); });
after(async () => { await api?.close(); fs.rmSync(dir, { recursive: true, force: true }); });

const badges = async date => {
  const r = await api.req('/api/days/' + date);
  assert.equal(r.status, 200);
  return Object.fromEntries(r.body.stories.map(s => [s.id.slice(11), { badge: s.badge, streak_days: s.streak_days }]));
};

describe('GET /api/days/:date — badge / streak_days (PRD §3.1)', () => {
  it('first day: everything specific is new', async () => {
    assert.deepEqual(await badges('2026-09-01'), { codex: { badge: 'new', streak_days: 1 }, musk: { badge: 'new', streak_days: 1 } });
  });
  it('Codex on 3 consecutive report days -> 持续热议 3 天 (case-insensitive topic match)', async () => {
    assert.deepEqual((await badges('2026-09-03')).codex, { badge: 'ongoing', streak_days: 4 - 1 });
  });
  it('a day without a report is skipped, not a break', async () => {
    assert.deepEqual((await badges('2026-09-05')).codex, { badge: 'ongoing', streak_days: 4 });
  });
  it('a report day without the topic breaks the streak; seen within 30 days -> no badge', async () => {
    const b = await badges('2026-09-07');
    assert.deepEqual(b.codex, { badge: null, streak_days: 1 });
    assert.deepEqual(b.broad, { badge: null, streak_days: null }, 'only broad topics -> no badge');
    // 马斯克 is in 3 stories today -> broad today; they only have their other (new) topics
    for (const k of ['m1', 'm2', 'm3']) assert.deepEqual(b[k], { badge: 'new', streak_days: 1 }, k);
  });
  it('legacy fields untouched, latest alias carries the badges too', async () => {
    const r = await api.req('/api/days/latest');
    assert.equal(r.body.date, '2026-09-07');
    const s = r.body.stories[0];
    for (const k of ['id', 'date', 'rank', 'headline_zh', 'summary_zh', 'why_it_matters', 'org_tag', 'category', 'categories', 'tags', 'heat', 'news_refs', 'data_quality', 'source_posts', 'favorited']) assert.ok(k in s, k);
    assert.ok('badge' in s && 'streak_days' in s);
    assert.deepEqual(s.tags, ['Codex']);
  });
  it('other endpoints keep their exact shape (no badge fields added)', async () => {
    const st = await api.req('/api/stories?q=codex');
    assert.ok(st.body.stories.length > 0);
    assert.ok(st.body.stories.every(s => !('badge' in s) && !('streak_days' in s)));
    const ex = await api.req('/api/export');
    assert.ok(ex.body.days.every(d => d.stories.every(s => !('badge' in s))));
  });
});
