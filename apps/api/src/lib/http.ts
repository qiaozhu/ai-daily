// Response helpers. Headers/body format are part of the public contract (pinned by tests/api):
// `application/json; charset=utf-8`, `Cache-Control: no-store` and the security headers below.
export const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy':
    "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'",
};

export function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...SECURITY_HEADERS,
      ...extra,
    },
  });
}

export const jsonError = (status: number, message: string): Response => json({ error: message }, status);

/** copy a response, (re)setting the security headers */
export function withSecurityHeaders(res: Response): Response {
  const h = new Headers(res.headers);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) h.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

/** the raw (still percent-encoded) path — Hono's c.req.path is partially decoded */
export const rawPathname = (req: Request): string => new URL(req.url).pathname;
