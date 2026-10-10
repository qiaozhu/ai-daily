// Write-protection for the only public write API (favorites).

const WINDOW_MS = 60_000;
const MAX_WRITES = 30;
const MAX_TRACKED_IPS = 5000;

/** best-effort per-isolate write throttle: >30 writes per IP per minute -> true */
export function createThrottle(now: () => number = Date.now) {
  const hits = new Map<string, number[]>();
  return function throttled(ip: string): boolean {
    const t = now();
    const recent = (hits.get(ip) ?? []).filter((x) => t - x < WINDOW_MS);
    recent.push(t);
    hits.set(ip, recent);
    if (hits.size > MAX_TRACKED_IPS) hits.clear();
    return recent.length > MAX_WRITES;
  };
}

/** CSRF-ish guard: cross-site browser writes are rejected (requests without browser headers, e.g. curl, pass) */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get('Origin');
  if (origin && origin !== new URL(req.url).origin) return false;
  const sfs = req.headers.get('Sec-Fetch-Site');
  return !sfs || sfs === 'same-origin' || sfs === 'none';
}

export const clientIp = (req: Request): string => req.headers.get('CF-Connecting-IP') || 'local';
