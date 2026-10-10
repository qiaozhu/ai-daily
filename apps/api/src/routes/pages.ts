// Page URLs the Worker answers itself (PRD v6 §3.0; listed in run_worker_first, everything else is static):
//   /trend  -> 301 /archive?tab=trend      /fav -> 301 /me        (other query params are kept)
//   /day/<date> -> the SPA shell with 200 when that report exists, 404 otherwise (bad format, impossible or
//                  missing date) — a real 404 status instead of silently falling back to the latest day.
// `/?d=<date>` -> /day/<date> is done by the front end: `/` is served straight from the asset layer (cached,
// no Worker invocation) and run_worker_first cannot match on a query string.
import { isCalendarDate, safeDecode } from '@ai-daily/shared';
import { Hono } from 'hono';
import type { AppEnv } from '../env.ts';
import { rawPathname, SECURITY_HEADERS } from '../lib/http.ts';
import { dayExists } from '../services/days.ts';

/** 301 to `path` (may carry its own query), appending the request's other query params */
export function redirectKeepingQuery(reqUrl: string, path: string): Response {
  const target = new URL(path, reqUrl);
  for (const [k, v] of new URL(reqUrl).searchParams) if (!target.searchParams.has(k)) target.searchParams.append(k, v);
  return new Response(null, {
    status: 301,
    headers: { Location: target.pathname + target.search, ...SECURITY_HEADERS },
  });
}

/** `/day/<raw segment>` -> the calendar date it names, or null (bad encoding, bad format, impossible date) */
export function dayFromPath(pathname: string): string | null {
  const m = /^\/day\/([^/]+)\/?$/.exec(pathname);
  if (!m) return null;
  const dec = safeDecode(m[1] as string);
  return dec.ok && isCalendarDate(dec.value) ? dec.value : null;
}

/** the SPA shell (index.html) with the given status and the security headers */
async function shell(c: { req: { raw: Request }; env: AppEnv['Bindings'] }, status: 200 | 404): Promise<Response> {
  const res = await c.env.ASSETS.fetch(new Request(new URL('/', c.req.raw.url), { headers: c.req.raw.headers }));
  const h = new Headers(res.headers);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) h.set(k, v);
  if (status === 404) h.set('Cache-Control', 'no-store');
  return new Response(res.body, { status: res.ok ? status : res.status, headers: h });
}

export const pageRoutes = new Hono<AppEnv>()
  .get('/trend', (c) => redirectKeepingQuery(c.req.url, '/archive?tab=trend'))
  .get('/fav', (c) => redirectKeepingQuery(c.req.url, '/me'))
  .get('/day/*', async (c) => {
    const date = dayFromPath(rawPathname(c.req.raw));
    return shell(c, date && (await dayExists(c.env.DB, date)) ? 200 : 404);
  });
