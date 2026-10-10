import { FavoriteBodySchema, FavoriteIdParamSchema } from '@ai-daily/shared';
import { Hono } from 'hono';
import type { AppEnv } from '../env.ts';
import { clientIp, createThrottle, isSameOrigin } from '../lib/guards.ts';
import { json, jsonError, rawPathname } from '../lib/http.ts';
import { parseOr400 } from '../lib/validate.ts';
import { addFavorite, listFavorites, removeFavorite } from '../services/favorites.ts';

// one throttle per isolate, shared by POST and DELETE (same as the legacy Worker)
const throttled = createThrottle();

export const favoriteRoutes = new Hono<AppEnv>()
  .get('/favorites', async (c) => json(await listFavorites(c.env.DB)))

  .post('/favorites', async (c) => {
    const req = c.req.raw;
    if (!isSameOrigin(req)) return jsonError(403, '禁止跨站请求');
    if (!(req.headers.get('Content-Type') || '').includes('application/json')) return jsonError(415, '需要 JSON');
    if (throttled(clientIp(req))) return jsonError(429, '操作太频繁，请稍后再试');
    const body: unknown = await req.json().catch(() => null);
    const { story_id: id } = parseOr400(FavoriteBodySchema, body);
    const result = await addFavorite(c.env.DB, id, Number(c.env.FAVORITES_MAX) || 2000);
    if (result === 'not_found') return jsonError(404, '故事不存在');
    if (result === 'cap_reached') return jsonError(409, '收藏已达上限');
    return json({ ok: true, story_id: id, favorited: true });
  })

  .delete('/favorites/:id{.+}', async (c) => {
    const req = c.req.raw;
    if (!isSameOrigin(req)) return jsonError(403, '禁止跨站请求');
    if (throttled(clientIp(req))) return jsonError(429, '操作太频繁，请稍后再试');
    const id = parseOr400(FavoriteIdParamSchema, rawPathname(req).slice('/api/favorites/'.length));
    const removed = await removeFavorite(c.env.DB, id);
    return json({ ok: true, story_id: id, removed });
  });
