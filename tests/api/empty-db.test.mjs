// Behaviour with migrations applied but no data imported yet (fresh deployment).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApi } from '../helpers/harness.mjs';

describe('empty database', () => {
  let api;
  before(async () => { api = await startApi({ seedFiles: null }); });
  after(async () => { await api?.close(); });

  it('/api/health reports zeros and latest=null', async () => {
    const r = await api.req('/api/health');
    assert.equal(r.status, 200);
    assert.deepEqual([r.body.days, r.body.stories, r.body.posts, r.body.latest], [0, 0, 0, null]);
  });
  it('/api/days -> empty list', async () => {
    assert.deepEqual((await api.req('/api/days')).body, { days: [], latest: null });
  });
  it('/api/days/latest -> 404 暂无数据', async () => {
    const r = await api.req('/api/days/latest');
    assert.equal(r.status, 404); assert.equal(r.body.error, '暂无数据');
  });
  it('/api/stories -> count 0', async () => {
    assert.deepEqual((await api.req('/api/stories?q=x')).body, { count: 0, stories: [] });
  });
  it('/api/trends -> empty arrays', async () => {
    const b = (await api.req('/api/trends')).body;
    assert.deepEqual(b, { days: [], per_day: [], category_totals: [], topics: [], recurring_topics: [] });
  });
  it('/api/export -> filename falls back to "empty"', async () => {
    const r = await api.req('/api/export');
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-disposition'), 'attachment; filename="ai-daily-export-empty.json"');
    assert.deepEqual([r.body.days, r.body.favorites], [[], []]);
  });
  it('POST /api/favorites for any id -> 404', async () => {
    const r = await api.req('/api/favorites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"story_id":"x"}' });
    assert.equal(r.status, 404);
  });
});
