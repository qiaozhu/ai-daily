// Page URLs answered by the Worker (PRD v6 §3.0 + F1 old-URL rules): 301s for the old #15 paths and a real
// HTTP 404 for /day/<date> without a report. (Hash links never reach the server: the front end rewrites them.)
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApi } from '../helpers/harness.mjs';

let api;
before(async () => { api = await startApi(); });
after(async () => { await api?.close(); });

const get = (p, init = {}) => api.req(p, { redirect: 'manual', ...init });
function assertSecurity(r) {
  assert.equal(r.headers.get('x-frame-options'), 'DENY');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
}

describe('old URLs -> 301 (other query params kept)', () => {
  for (const [from, to] of [
    ['/trend', '/archive?tab=trend'],
    ['/trend?c=%E8%8A%AF%E7%89%87', '/archive?tab=trend&c=%E8%8A%AF%E7%89%87'],
    ['/trend?tab=daily&x=1', '/archive?tab=trend&x=1'],
    ['/fav', '/me'],
    ['/fav?utm_source=x', '/me?utm_source=x'],
  ]) {
    it(`${from} -> 301 ${to}`, async () => {
      const r = await get(from);
      assert.equal(r.status, 301);
      assert.equal(r.headers.get('location'), to);
      assertSecurity(r);
    });
  }
  it('HEAD /trend -> 301 too', async () => {
    const r = await get('/trend', { method: 'HEAD' });
    assert.equal(r.status, 301);
    assert.equal(r.headers.get('location'), '/archive?tab=trend');
  });
});

describe('/day/<date>', () => {
  it('existing report -> 200 SPA shell', async () => {
    for (const d of ['2026-10-10', '2026-10-08']) {
      const r = await get('/day/' + d);
      assert.equal(r.status, 200, d);
      assert.match(r.headers.get('content-type'), /text\/html/);
      assert.match(r.text, /<div id="root">/);
      assertSecurity(r);
    }
  });
  for (const p of ['/day/2000-01-01', '/day/2026-10-11', '/day/2026-13-45', '/day/2026-02-30', '/day/abc', '/day/%ZZ', '/day/2026-10-10x']) {
    it(`${p} -> 404 page (HTML, no og: tags)`, async () => {
      const r = await get(p);
      assert.equal(r.status, 404);
      assert.match(r.headers.get('content-type'), /text\/html/);
      assert.match(r.text, /<div id="root">/, 'the SPA renders the 404 page');
      assert.doesNotMatch(r.text, /property="og:/);
      assert.equal(r.headers.get('cache-control'), 'no-store');
      assertSecurity(r);
    });
  }
  it('`/` stays a plain static asset (?d= is redirected by the front end)', async () => {
    const r = await get('/?d=2026-10-09');
    assert.equal(r.status, 200);
    assert.match(r.text, /<div id="root">/);
  });
});

// HTML must never be cached for long: the home page changes every day at 08:50 (and its og:image will point at
// that day's card, PRD #26), so browsers / crawlers must revalidate. Hashed /assets/* are the only immutable files.
describe('HTML is not long-cached', () => {
  const maxAge = (cc) => Number(/max-age=(\d+)/.exec(cc || '')?.[1] ?? 0);
  for (const p of ['/', '/?d=2026-10-09', '/search', '/archive', '/me', '/day/2026-10-10', '/day/2000-01-01']) {
    it(`${p}: Cache-Control is short (<= 300 s) or revalidating, never immutable`, async () => {
      const r = await get(p);
      assert.match(r.headers.get('content-type'), /text\/html/);
      const cc = r.headers.get('cache-control') || '';
      assert.doesNotMatch(cc, /immutable/, cc);
      assert.ok(maxAge(cc) <= 300, `${p}: ${cc}`);
    });
  }
});
