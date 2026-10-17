// Page URLs the Worker answers itself (PRD v6 §3.0 / F3; listed in run_worker_first, everything else is static):
//   /trend  -> 301 /archive?tab=trend      /fav -> 301 /me        (other query params are kept)
//   /day/<date>  -> the SPA shell + og tags (200) when that report exists, 404 page without og tags otherwise
//   /story/<id>  -> the SPA shell + og tags (200) when the story exists, 404 page without og tags otherwise
//   /                -> the SPA shell + og tags of the latest day (og:image /og/day/<latest>.png)
//   /search, /archive, /me -> the SPA shell + og tags with the static default image /og/default-og.png
//   /og/day/<date>.png, /og/story/<id>.png [?size=portrait] -> share card (src/routes/og.ts)
// og:image rules: PRD v6 §3.0 as amended by PR #26 (existing day / story -> its /og/… URL, pages without a day or
// story -> the static default image, 404 pages -> no og tags at all). HTML with og tags is cached for 5 minutes
// at most (HTML_CACHE): the home page changes when the 08:50 report lands.
// `/?d=<date>` -> /day/<date> stays in the front end (PRD #26: the first request may be 200).
import { isCalendarDate, safeDecode, storyIdFromSegment } from '@ai-daily/shared';
import { Hono } from 'hono';
import type { DayRow, StoryRow } from '../db/rows.ts';
import { SQL } from '../db/sql.ts';
import type { AppEnv } from '../env.ts';
import { rawPathname, SECURITY_HEADERS } from '../lib/http.ts';
import { parseJson } from '../lib/json.ts';
import { clip, injectOg, SITE_NAME, stripOg, type OgMeta } from '../lib/og.ts';
import { ogRoutes } from './og.ts';

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

/** `/story/<raw segment>` -> story id, or null */
export function storyFromPath(pathname: string): string | null {
  const m = /^\/story\/([^/]+)\/?$/.exec(pathname);
  return m ? storyIdFromSegment(m[1] as string) : null;
}

/** "2026-10-09" -> "10月9日" */
export const dateCN = (d: string): string => d.replace(/^\d+-0?(\d+)-0?(\d+)$/, '$1月$2日');

interface Ctx {
  req: { raw: Request };
  env: AppEnv['Bindings'];
}

/**
 * Cache-Control of HTML pages with og tags (docs/adr/0003): browsers always revalidate (max-age=0 + ETag -> 304),
 * so after a deploy they never run an old shell that points at deleted hashed /assets; shared caches may keep it
 * 5 minutes (s-maxage=300), so crawlers see the new day's card at most ~5 minutes after 08:50.
 */
export const HTML_CACHE = 'public, max-age=0, must-revalidate, s-maxage=300';

/** weak ETag from the final HTML (sha-256, first 16 hex chars) */
async function etagOf(body: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body)));
  return `W/"${[...d.slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('')}"`;
}

/** the SPA shell (index.html) with the given status and the security headers; og tags only on 200 */
async function shell(c: Ctx, status: 200 | 404, og?: OgMeta): Promise<Response> {
  // no conditional headers: the body is rewritten, so the static file's ETag / 304 must not leak through
  const res = await c.env.ASSETS.fetch(new Request(new URL('/', c.req.raw.url)));
  const h = new Headers(res.headers);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) h.set(k, v);
  h.delete('ETag');
  if (!res.ok) return new Response(res.body, { status: res.status, headers: h });
  if (status === 404 || !og) {
    h.set('Cache-Control', 'no-store');
    return stripOg(new Response(res.body, { status, headers: h }));
  }
  const html = await injectOg(new Response(res.body, { status, headers: h }), og).text();
  const etag = await etagOf(html);
  h.set('ETag', etag);
  h.set('Cache-Control', HTML_CACHE);
  h.delete('Content-Length');
  const inm = c.req.raw.headers.get('If-None-Match');
  if (inm && inm.split(',').some((t) => t.trim() === etag)) return new Response(null, { status: 304, headers: h });
  return new Response(c.req.raw.method === 'HEAD' ? null : html, { status, headers: h });
}

export function dayOg(origin: string, d: Pick<DayRow, 'date' | 'highlights_json'>): OgMeta {
  const parsed = parseJson<unknown>(d.highlights_json, []);
  const highlights = (Array.isArray(parsed) ? parsed : [])
    .filter((h): h is string => typeof h === 'string')
    .slice(0, 3);
  return {
    title: `${dateCN(d.date)} AI 热点 · ${SITE_NAME}`,
    description: clip(highlights.join('；') || `${dateCN(d.date)}的 AI 热点日报`, 150),
    url: `${origin}/day/${d.date}`,
    image: `${origin}/og/day/${d.date}.png`,
    type: 'website',
  };
}

export function storyOg(origin: string, s: Pick<StoryRow, 'id' | 'headline_zh' | 'summary_zh'>): OgMeta {
  const id = encodeURIComponent(s.id);
  return {
    title: clip(s.headline_zh, 80),
    description: clip(s.summary_zh || s.headline_zh, 150),
    url: `${origin}/story/${id}`,
    image: `${origin}/og/story/${id}.png`,
    type: 'article',
  };
}

interface StaticPage {
  title: string;
  description: string;
}

/** pages without a day or story of their own: static default image (PRD #26) */
export const STATIC_PAGES = {
  '/search': { title: `搜索 · ${SITE_NAME}`, description: '搜索往期 AI 热点话题' },
  '/archive': { title: `往期 · ${SITE_NAME}`, description: '往期日报、话题趋势和周报' },
  '/me': { title: `我的 · ${SITE_NAME}`, description: '收藏和设置' },
} satisfies Record<string, StaticPage>;
const HOME_DESCRIPTION = '每日从 X 平台汇总的 AI 热点资讯（中文）';

export function staticOg(origin: string, path: string, page: StaticPage): OgMeta {
  return {
    title: page.title,
    description: page.description,
    url: origin + path,
    image: `${origin}/og/default-og.png`,
    type: 'website',
  };
}

export const pageRoutes = new Hono<AppEnv>()
  .get('/', async (c) => {
    const origin = new URL(c.req.url).origin;
    const latest = await c.env.DB.prepare(SQL.latestDate).first<{ d: string | null }>();
    const row = latest?.d ? await c.env.DB.prepare(SQL.dayByDate).bind(latest.d).first<DayRow>() : null;
    const og = row
      ? { ...dayOg(origin, row), title: SITE_NAME, url: `${origin}/` }
      : staticOg(origin, '/', { title: SITE_NAME, description: HOME_DESCRIPTION });
    return shell(c, 200, og);
  })
  .get('/search', (c) => shell(c, 200, staticOg(new URL(c.req.url).origin, '/search', STATIC_PAGES['/search'])))
  .get('/archive', (c) => shell(c, 200, staticOg(new URL(c.req.url).origin, '/archive', STATIC_PAGES['/archive'])))
  .get('/me', (c) => shell(c, 200, staticOg(new URL(c.req.url).origin, '/me', STATIC_PAGES['/me'])))
  .get('/trend', (c) => redirectKeepingQuery(c.req.url, '/archive?tab=trend'))
  .get('/fav', (c) => redirectKeepingQuery(c.req.url, '/me'))
  .get('/day/*', async (c) => {
    const date = dayFromPath(rawPathname(c.req.raw));
    const row = date ? await c.env.DB.prepare(SQL.dayByDate).bind(date).first<DayRow>() : null;
    return row ? shell(c, 200, dayOg(new URL(c.req.url).origin, row)) : shell(c, 404);
  })
  .get('/story/*', async (c) => {
    const id = storyFromPath(rawPathname(c.req.raw));
    const row = id ? await c.env.DB.prepare(SQL.storyById).bind(id).first<StoryRow>() : null;
    return row ? shell(c, 200, storyOg(new URL(c.req.url).origin, row)) : shell(c, 404);
  })
  .route('/og', ogRoutes);
