// Favorites: the only public write API (same-origin guard, JSON only, story must exist, per-IP throttle, global cap).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApi } from '../helpers/harness.mjs';

const JSONH = { 'Content-Type': 'application/json' };
const A = '2026-10-10-xai-grok-bot', B = '2026-10-09-quotes-unicode', C = '2026-10-08-old-openai';

describe('favorites CRUD', () => {
  let api;
  before(async () => { api = await startApi(); });
  after(async () => { await api?.close(); });
  const add = (id, headers = {}) => api.req('/api/favorites', { method: 'POST', headers: { ...JSONH, ...headers }, body: JSON.stringify({ story_id: id }) });
  const del = (id, headers = {}) => api.req('/api/favorites/' + encodeURIComponent(id), { method: 'DELETE', headers });

  it('starts empty', async () => {
    const r = await api.req('/api/favorites');
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type'), /^application\/json/);
    assert.deepEqual(r.body, { count: 0, ids: [], stories: [] });
  });

  it('POST adds a favorite (no Origin header, like curl)', async () => {
    const r = await add(A);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { ok: true, story_id: A, favorited: true });
    assert.equal(r.headers.get('cache-control'), 'no-store');
  });

  it('POST with same Origin + Sec-Fetch-Site: same-origin is accepted', async () => {
    const r = await add(B, { Origin: api.base, 'Sec-Fetch-Site': 'same-origin' });
    assert.equal(r.status, 200);
  });

  it('POST is idempotent', async () => {
    assert.equal((await add(A)).status, 200);
    assert.equal((await api.req('/api/favorites')).body.count, 2);
  });

  it('GET lists favorites newest first, hydrated, with favorited=true', async () => {
    const r = await api.req('/api/favorites');
    assert.equal(r.body.count, 2);
    assert.deepEqual(r.body.ids, [B, A]);
    assert.ok(r.body.stories.every(s => s.favorited === true && Array.isArray(s.source_posts)));
    assert.equal(r.body.stories[1].source_posts.length, 3);
  });

  it('favorited flag shows up in /api/days, /api/stories and /api/export', async () => {
    const day = await api.req('/api/days/2026-10-10');
    assert.deepEqual(day.body.stories.filter(s => s.favorited).map(s => s.id), [A]);
    const st = await api.req('/api/stories?q=UNIQUEWORDALPHA');
    assert.equal(st.body.stories[0].favorited, true);
    const ex = await api.req('/api/export');
    assert.deepEqual(ex.body.favorites.map(f => f.story_id).sort(), [A, B].sort());
    assert.ok(ex.body.favorites.every(f => !Number.isNaN(Date.parse(f.created_at))));
  });

  it('POST unknown story -> 404', async () => {
    const r = await add('no-such-story');
    assert.equal(r.status, 404); assert.equal(r.body.error, '故事不存在');
  });

  it('POST missing / empty / non-object body -> 404 (story_id resolves to "")', async () => {
    for (const body of ['{}', '{"story_id":""}', 'null', '[]', 'not json', '']) {
      const r = await api.req('/api/favorites', { method: 'POST', headers: JSONH, body });
      assert.equal(r.status, 404, body);
    }
  });

  it('POST without JSON content-type -> 415', async () => {
    for (const ct of [undefined, 'text/plain', 'application/x-www-form-urlencoded']) {
      const r = await api.req('/api/favorites', { method: 'POST', headers: ct ? { 'Content-Type': ct } : {}, body: JSON.stringify({ story_id: C }) });
      assert.equal(r.status, 415, String(ct)); assert.equal(r.body.error, '需要 JSON');
    }
  });

  it('POST cross-site -> 403 (Origin mismatch or Sec-Fetch-Site cross-site/same-site)', async () => {
    for (const h of [{ Origin: 'https://evil.example' }, { 'Sec-Fetch-Site': 'cross-site' }, { 'Sec-Fetch-Site': 'same-site' }, { Origin: 'null' }]) {
      const r = await add(C, h);
      assert.equal(r.status, 403, JSON.stringify(h)); assert.equal(r.body.error, '禁止跨站请求');
    }
    assert.ok(!(await api.req('/api/favorites')).body.ids.includes(C));
  });

  it('DELETE cross-site -> 403 and nothing removed', async () => {
    const r = await del(A, { Origin: 'https://evil.example' });
    assert.equal(r.status, 403);
    assert.ok((await api.req('/api/favorites')).body.ids.includes(A));
  });

  it('DELETE removes a favorite', async () => {
    const r = await del(A, { Origin: api.base });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { ok: true, story_id: A, removed: 1 });
    assert.deepEqual((await api.req('/api/favorites')).body.ids, [B]);
  });

  it('DELETE of a non-favorited id -> 200 removed:0', async () => {
    const r = await del('never-favorited');
    assert.equal(r.status, 200); assert.equal(r.body.removed, 0);
  });

  it('DELETE handles url-encoded ids (quotes / unicode)', async () => {
    const r = await del("weird 'id'/中文");
    assert.equal(r.status, 200); assert.equal(r.body.story_id, "weird 'id'/中文");
  });

  it('DELETE with invalid percent-encoding -> 400, not 500', { todo: 'BUG-3: DELETE /api/favorites/%ZZ -> decodeURIComponent throws -> 500' }, async () => {
    const r = await api.req('/api/favorites/%ZZ', { method: 'DELETE' });
    assert.equal(r.status, 400);
  });

  it('favorites survive re-importing a day (no FK, ids stable)', async () => {
    // re-run the import for 2026-10-09 (B is still favorited)
    const { seed, FIXTURE_DAY } = await import('../helpers/harness.mjs');
    await seed(api.db, [FIXTURE_DAY]);
    assert.deepEqual((await api.req('/api/favorites')).body.ids, [B]);
    assert.equal((await api.req('/api/health')).body.stories, 15);
  });

  it('write throttle: 31st write per IP within a minute -> 429, other IPs unaffected', async () => {
    const ip = { 'CF-Connecting-IP': '203.0.113.7' };
    const codes = [];
    for (let i = 0; i < 31; i++) codes.push((await del('throttle-' + i, ip)).status);
    assert.deepEqual(codes.slice(0, 30), Array(30).fill(200));
    assert.equal(codes[30], 429);
    const r = await add(C, ip);
    assert.equal(r.status, 429); assert.equal(r.body.error, '操作太频繁，请稍后再试');
    assert.equal((await add(C, { 'CF-Connecting-IP': '203.0.113.8' })).status, 200);
    // reads are never throttled
    assert.equal((await api.req('/api/favorites', { headers: ip })).status, 200);
  });
});

describe('favorites cap (FAVORITES_MAX)', () => {
  let api;
  before(async () => { api = await startApi({ vars: { FAVORITES_MAX: '2' } }); });
  after(async () => { await api?.close(); });
  const add = id => api.req('/api/favorites', { method: 'POST', headers: JSONH, body: JSON.stringify({ story_id: id }) });

  it('409 once the cap is reached', async () => {
    assert.equal((await add(A)).status, 200);
    assert.equal((await add(B)).status, 200);
    const r = await add(C);
    assert.equal(r.status, 409); assert.equal(r.body.error, '收藏已达上限');
    assert.equal((await api.req('/api/favorites')).body.count, 2);
  });

  it('re-favoriting an already-favorited story at the cap stays idempotent (200)', { todo: 'BUG-4: at the cap, POST of an already-favorited id -> 409 instead of 200 (cap check runs before INSERT OR IGNORE)' }, async () => {
    const r = await add(A);
    assert.equal(r.status, 200);
  });

  it('after deleting one, adding works again', async () => {
    assert.equal((await api.req('/api/favorites/' + B, { method: 'DELETE' })).status, 200);
    assert.equal((await add(C)).status, 200);
  });
});
