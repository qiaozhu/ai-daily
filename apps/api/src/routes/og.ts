// Share card images (PRD v6 F3 + PR #26 rules): /og/day/<date>.png, /og/story/<id>.png, `?size=portrait` = 竖版.
//   1. the day / story exists and KV (binding CARDS) has the card -> that PNG, long cache
//   2. it exists but there is no card yet (or no CARDS binding)    -> default brand image, 200 image/png, short cache
//   3. it does not exist (or the URL is malformed)                -> 404
// KV keys are internal: card/{kind}/{id or date}/{og|save}.png (same as packages/share-card cardKey and #22's script).
// Responses are also kept in the Cache API (keyed by the canonical URL), so repeat hits skip D1 and KV.
import { isCalendarDate, safeDecode, storyIdFromSegment } from '@ai-daily/shared';
import { Hono, type Context } from 'hono';
import { SQL } from '../db/sql.ts';
import type { AppEnv } from '../env.ts';
import { rawPathname, SECURITY_HEADERS } from '../lib/http.ts';

export type CardKind = 'day' | 'story';
export type CardSize = 'og' | 'save';

export const CARD_CACHE = 'public, max-age=604800';
export const DEFAULT_CACHE = 'public, max-age=300';
export const DEFAULT_IMAGES: Record<CardSize, string> = { og: '/og/default-og.png', save: '/og/default-portrait.png' };

export const cardKey = (kind: CardKind, idOrDate: string, size: CardSize): string =>
  `card/${kind}/${idOrDate}/${size}.png`;

/** /og/<kind>/<raw>.png -> { kind, key } or null (malformed) */
export function parseCardPath(pathname: string): { kind: CardKind; key: string } | null {
  const m = /^\/og\/(day|story)\/([^/]+)\.png$/.exec(pathname);
  if (!m) return null;
  const kind = m[1] as CardKind;
  const raw = m[2] as string;
  if (kind === 'day') {
    const dec = safeDecode(raw);
    return dec.ok && isCalendarDate(dec.value) ? { kind, key: dec.value } : null;
  }
  const id = storyIdFromSegment(raw);
  return id ? { kind, key: id } : null;
}

const png = (body: BodyInit | null, cache: string, source: 'card' | 'default') =>
  new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'image/png', 'Cache-Control': cache, 'X-Card-Source': source, ...SECURITY_HEADERS },
  });

const notFound = () =>
  new Response('not found', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...SECURITY_HEADERS },
  });

const edgeCache = (): Cache | null =>
  typeof caches !== 'undefined' ? (caches as unknown as { default: Cache }).default : null;

const card = async (c: Context<AppEnv>): Promise<Response> => {
  const card = parseCardPath(rawPathname(c.req.raw));
  if (!card) return notFound();
  const size: CardSize = new URL(c.req.url).searchParams.get('size') === 'portrait' ? 'save' : 'og';
  const origin = new URL(c.req.url).origin;
  const cacheKey = new Request(
    `${origin}/og/${card.kind}/${encodeURIComponent(card.key)}.png${size === 'save' ? '?size=portrait' : ''}`,
  );
  const cache = edgeCache();
  const hit = await cache?.match(cacheKey).catch(() => undefined);
  if (hit) return hit;

  const exists = await c.env.DB.prepare(card.kind === 'day' ? SQL.dayExists : SQL.storyExists)
    .bind(card.key)
    .first();
  if (!exists) return notFound();

  const stored = c.env.CARDS ? await c.env.CARDS.get(cardKey(card.kind, card.key, size), 'arrayBuffer') : null;
  let res: Response;
  if (stored) res = png(stored, CARD_CACHE, 'card');
  else {
    const def = await c.env.ASSETS.fetch(new Request(new URL(DEFAULT_IMAGES[size], c.req.url)));
    if (!def.ok) return notFound();
    res = png(def.body, DEFAULT_CACHE, 'default');
  }
  if (cache) {
    const put = cache.put(cacheKey, res.clone()).catch(() => undefined);
    try {
      c.executionCtx.waitUntil(put);
    } catch {
      await put; // no execution context (unit tests)
    }
  }
  return res;
};

export const ogRoutes = new Hono<AppEnv>().get('/day/*', card).get('/story/*', card);
