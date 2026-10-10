// Unit tests of the Hono app with an in-memory D1 stub (no Worker runtime). Full behaviour against real D1 is
// covered by the black-box suite in tests/api.
import { describe, expect, it, vi } from 'vitest';
import { createApp } from './app.ts';
import { SQL } from './db/sql.ts';

type Handler = (sql: string, args: unknown[]) => { first?: unknown; all?: unknown[]; changes?: number };

/** minimal D1Database stand-in: every statement is answered by `handler`; executed SQL is recorded */
function fakeDb(handler: Handler = () => ({})) {
  const log: { sql: string; args: unknown[] }[] = [];
  const stmt = (sql: string, args: unknown[] = []) => ({
    bind: (...a: unknown[]) => stmt(sql, a),
    first: async () => {
      log.push({ sql, args });
      return handler(sql, args).first ?? null;
    },
    all: async () => {
      log.push({ sql, args });
      return { results: handler(sql, args).all ?? [] };
    },
    run: async () => {
      log.push({ sql, args });
      return { meta: { changes: handler(sql, args).changes ?? 0 } };
    },
  });
  const db = {
    prepare: (sql: string) => stmt(sql),
    batch: async (stmts: { all: () => Promise<unknown> }[]) => Promise.all(stmts.map((s) => s.all())),
  };
  return { db: db as unknown as D1Database, log };
}

const assets = { fetch: vi.fn(async () => new Response('asset', { status: 200 })) } as unknown as Fetcher;

function call(path: string, init: RequestInit = {}, handler?: Handler, vars: Record<string, string> = {}) {
  const { db, log } = fakeDb(handler);
  const app = createApp();
  const res = app.request('http://localhost' + path, init, { DB: db, ASSETS: assets, ...vars });
  return { res: Promise.resolve(res), log };
}

describe('validation layer: formerly-500 inputs now 400', () => {
  it('BUG-1 GET /api/days/%ZZ -> 400 JSON, DB untouched', async () => {
    const { res, log } = call('/api/days/%ZZ');
    const r = await res;
    expect(r.status).toBe(400);
    expect(r.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(await r.json()).toEqual({ error: 'URL 编码无效' });
    expect(log).toHaveLength(0);
  });

  it('BUG-3 DELETE /api/favorites/%ZZ -> 400, nothing deleted', async () => {
    const { res, log } = call('/api/favorites/%ZZ', { method: 'DELETE' });
    const r = await res;
    expect(r.status).toBe(400);
    expect((await r.json()) as unknown).toEqual({ error: 'URL 编码无效' });
    expect(log.some((l) => l.sql === SQL.favoriteDelete)).toBe(false);
  });

  it('BUG-2 GET /api/stories?limit=1.5 -> 200 with an integer SQL LIMIT', async () => {
    const { res, log } = call('/api/stories?limit=1.5');
    const r = await res;
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ count: 0, stories: [] });
    expect(log[0]?.sql).toMatch(/LIMIT 1$/);
  });

  it('MINOR-2 GET /api/days/2026-13-45 -> 400 (impossible date) instead of a DB lookup', async () => {
    const { res, log } = call('/api/days/2026-13-45');
    const r = await res;
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: '日期格式应为 YYYY-MM-DD' });
    expect(log).toHaveLength(0);
  });

  it('MINOR-1 HEAD /api/days -> 200 like GET, empty body', async () => {
    const { res } = call('/api/days', { method: 'HEAD' });
    const r = await res;
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(await r.text()).toBe('');
  });

  it('HEAD on an unknown API route -> 404 (not 405)', async () => {
    expect((await call('/api/nope', { method: 'HEAD' }).res).status).toBe(404);
  });
});

describe('BUG-4 favorites cap is idempotent for already-favorited stories', () => {
  const handler: Handler = (sql) => {
    if (sql === SQL.storyExists) return { first: { 1: 1 } };
    if (sql === SQL.isFavorite) return { first: { 1: 1 } };
    if (sql === SQL.favoritesCount) return { first: { n: 2 } };
    return {};
  };
  it('POST an existing favorite at the cap -> 200, no insert', async () => {
    const { res, log } = call(
      '/api/favorites',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"story_id":"a"}' },
      handler,
      { FAVORITES_MAX: '2' },
    );
    const r = await res;
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, story_id: 'a', favorited: true });
    expect(log.some((l) => l.sql === SQL.favoriteInsert)).toBe(false);
  });
  it('POST a new favorite at the cap -> 409', async () => {
    const { res } = call(
      '/api/favorites',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"story_id":"b"}' },
      (sql) => (sql === SQL.isFavorite ? {} : handler(sql, [])),
      { FAVORITES_MAX: '2' },
    );
    const r = await res;
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ error: '收藏已达上限' });
  });
});

describe('contract details', () => {
  it('unexpected DB errors -> 500 服务器错误 (no stack leak)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { res } = call('/api/health', {}, () => {
      throw new Error('boom');
    });
    const r = await res;
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ error: '服务器错误' });
    spy.mockRestore();
  });
  it('wrong method on an API path -> 405, unknown GET -> 404', async () => {
    expect((await call('/api/days', { method: 'POST' }).res).status).toBe(405);
    expect((await call('/api/favorites/x').res).status).toBe(404);
  });
  it('non-API paths fall through to static assets with security headers', async () => {
    const r = await call('/somewhere.png').res;
    expect(await r.text()).toBe('asset');
    expect(r.headers.get('x-frame-options')).toBe('DENY');
  });
  it('/favicon.ico -> 204', async () => {
    expect((await call('/favicon.ico').res).status).toBe(204);
  });
});
