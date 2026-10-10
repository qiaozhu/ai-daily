// Request validation shared by the API (authoritative) and the web client (to build valid requests).
// Every schema reproduces the legacy src/worker.js coercion rules exactly, except where the legacy code
// threw (-> HTTP 500); those cases now fail validation and the API answers 400.
import { z } from 'zod';

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** legacy shape check (YYYY-MM-DD, any digits) — still used for the optional from/to filters */
export const isDateShape = (s: unknown): s is string => typeof s === 'string' && DATE_RE.test(s);

/** shape + real calendar date (rejects 2026-13-45, 2026-02-30) */
export function isCalendarDate(s: unknown): s is string {
  if (!isDateShape(s)) return false;
  const [y, m, d] = s.split('-').map(Number) as [number, number, number];
  if (m < 1 || m > 12 || d < 1) return false;
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d <= dim;
}

/** decodeURIComponent that reports failure instead of throwing (legacy threw URIError -> 500) */
export function safeDecode(s: string): { ok: true; value: string } | { ok: false } {
  try {
    return { ok: true, value: decodeURIComponent(s) };
  } catch {
    return { ok: false };
  }
}

export const MESSAGES = {
  badDate: '日期格式应为 YYYY-MM-DD',
  badEncoding: 'URL 编码无效',
} as const;

/**
 * `/api/days/:date` path segment (raw, still percent-encoded).
 * -> { kind: 'latest' } | { kind: 'date', date }; errors carry the 400 message.
 */
export type DayParam = { kind: 'latest' } | { kind: 'date'; date: string };

export const DayParamSchema = z.string().transform((raw, ctx): DayParam => {
  const dec = safeDecode(raw);
  if (!dec.ok) {
    ctx.addIssue({ code: 'custom', message: MESSAGES.badEncoding });
    return z.NEVER;
  }
  if (dec.value === 'latest') return { kind: 'latest' };
  if (isCalendarDate(dec.value)) return { kind: 'date', date: dec.value };
  ctx.addIssue({ code: 'custom', message: MESSAGES.badDate });
  return z.NEVER;
});

/**
 * `limit` query param. Legacy: Math.min(200, Math.max(1, +limit || 100)), which produced e.g. `LIMIT 1.5`
 * (SQL error -> 500). Same coercion, then truncated to an integer.
 */
export function parseLimit(raw: string | null | undefined): number {
  const n = Math.min(200, Math.max(1, Number(raw ?? 0) || 100));
  return Math.floor(n);
}

export const StoriesQuerySchema = z.object({
  q: z
    .string()
    .nullish()
    .transform((v) => (v ?? '').trim().slice(0, 100)),
  category: z
    .string()
    .nullish()
    .transform((v) => (v ?? '').trim()),
  from: z
    .string()
    .nullish()
    .transform((v) => (isDateShape(v) ? v : null)),
  to: z
    .string()
    .nullish()
    .transform((v) => (isDateShape(v) ? v : null)),
  limit: z.string().nullish().transform(parseLimit),
});
export type StoriesQuery = z.output<typeof StoriesQuerySchema>;

/** search terms: whitespace-separated, max 5 (one bound SQL param each) */
export const searchTerms = (q: string): string[] => q.split(/\s+/).filter(Boolean).slice(0, 5);

/**
 * POST /api/favorites body (already JSON-parsed, null when the body was not JSON).
 * Legacy: String((body && body.story_id) || '').slice(0, 200) — kept verbatim (unknown ids then 404).
 */
export const FavoriteBodySchema = z.unknown().transform((body) => {
  const v = (body as { story_id?: unknown } | null | undefined)?.story_id;
  return { story_id: String(v || '').slice(0, 200) };
});

/** DELETE /api/favorites/:id raw path segment */
export const FavoriteIdParamSchema = z.string().transform((raw, ctx) => {
  const dec = safeDecode(raw);
  if (!dec.ok) {
    ctx.addIssue({ code: 'custom', message: MESSAGES.badEncoding });
    return z.NEVER;
  }
  return dec.value;
});
