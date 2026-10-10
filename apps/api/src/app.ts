import { Hono } from 'hono';
import type { AppEnv } from './env.ts';
import { jsonError, withSecurityHeaders } from './lib/http.ts';
import { ValidationError, validationResponse } from './lib/validate.ts';
import { favoriteRoutes } from './routes/favorites.ts';
import { readRoutes } from './routes/read.ts';

const isApi = (pathname: string) => pathname.startsWith('/api/');

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

export function createApp() {
  const app = new Hono<AppEnv>();

  app.route('/api', readRoutes);
  app.route('/api', favoriteRoutes);

  // Non-API requests only reach the Worker when no static asset matched (run_worker_first: ["/api/*"]).
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
    if (isSpaFallbackForFile(pathname, res)) return withSecurityHeaders(new Response(null, { status: 404 }));
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
