import { Hono } from 'hono';
import type { AppEnv } from './env.ts';
import { jsonError, withSecurityHeaders } from './lib/http.ts';
import { ValidationError, validationResponse } from './lib/validate.ts';
import { favoriteRoutes } from './routes/favorites.ts';
import { pageRoutes } from './routes/pages.ts';
import { readRoutes } from './routes/read.ts';

/** "/api" itself is an (unknown) API path too, never the SPA shell */
export const isApi = (pathname: string) => pathname === '/api' || pathname.startsWith('/api/');

/** "/x.png", "/a/b.txt" — a last path segment with an extension (pages like /search have none) */
export const isFileLike = (pathname: string) => /\.[^/.]+$/.test(pathname);

/** the assets layer answered a file-like URL with the SPA's index.html (= the file does not exist) */
export function isSpaFallbackForFile(pathname: string, res: Response): boolean {
  return (
    isFileLike(pathname) &&
    !/\.html?$/i.test(pathname) &&
    res.status === 200 &&
    (res.headers.get('Content-Type') || '').startsWith('text/html')
  );
}

/** a real 404 for a missing static file: never cached (no long-cache header from _headers), no SPA shell */
export const missingFile = (): Response =>
  withSecurityHeaders(new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } }));

/**
 * /assets/* (content-hashed build output, run_worker_first): an existing file is returned as the asset layer
 * served it (incl. the 1-year immutable Cache-Control from _headers); anything else — not found, or the SPA
 * fallback's index.html — is a 404 with no-store, so a typo'd/stale hash is never cached as HTML for a year.
 */
export function assetOr404(res: Response): Response {
  const html = (res.headers.get('Content-Type') || '').startsWith('text/html');
  return res.ok && !html ? withSecurityHeaders(res) : missingFile();
}

export function createApp() {
  const app = new Hono<AppEnv>();

  app.route('/api', readRoutes);
  app.route('/api', favoriteRoutes);
  app.route('/', pageRoutes);
  // /assets itself, /assets/ and anything below: a real file or 404 (never the SPA shell); a malformed path that
  // the asset layer rejects is a 404 too
  const assets = async (c: { env: AppEnv['Bindings']; req: { raw: Request } }) =>
    assetOr404(await c.env.ASSETS.fetch(c.req.raw).catch(() => new Response(null, { status: 404 })));
  app.get('/assets', assets);
  app.get('/assets/*', assets);

  // Other non-API requests reach the Worker only for the run_worker_first paths (apps/api/wrangler.jsonc).
  app.all('/favicon.ico', () => new Response(null, { status: 204 }));

  app.notFound(async (c) => {
    const { pathname } = new URL(c.req.url);
    if (isApi(pathname)) {
      // unknown API route or wrong method: GET/HEAD -> 404, anything else -> 405 (legacy contract)
      const m = c.req.method;
      return m === 'GET' || m === 'HEAD' ? jsonError(404, 'not found') : jsonError(405, 'method not allowed');
    }
    const res = await c.env.ASSETS.fetch(c.req.raw);
    // a missing *file* must not be answered with the SPA shell (broken <img>/<script> would get HTML with 200)
    if (isSpaFallbackForFile(pathname, res)) return missingFile();
    return withSecurityHeaders(res);
  });

  app.onError((err) => {
    if (err instanceof ValidationError) return validationResponse(err);
    console.error(err);
    return jsonError(500, '服务器错误');
  });

  return app;
}

export type App = ReturnType<typeof createApp>;
