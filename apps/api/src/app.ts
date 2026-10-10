import { Hono } from 'hono';
import type { AppEnv } from './env.ts';
import { jsonError, withSecurityHeaders } from './lib/http.ts';
import { ValidationError, validationResponse } from './lib/validate.ts';
import { favoriteRoutes } from './routes/favorites.ts';
import { readRoutes } from './routes/read.ts';

const isApi = (pathname: string) => pathname.startsWith('/api/');

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
    return withSecurityHeaders(await c.env.ASSETS.fetch(c.req.raw));
  });

  app.onError((err) => {
    if (err instanceof ValidationError) return validationResponse(err);
    console.error(err);
    return jsonError(500, '服务器错误');
  });

  return app;
}

export type App = ReturnType<typeof createApp>;
