// Pure formatting helpers (ported 1:1 from the v5 app.js).

/** 12345 -> "1.2万", 1.5e8 -> "1.5亿", null -> "" */
export function formatCount(n: number | null | undefined): string {
  if (n == null) return '';
  if (n >= 1e8) return (n / 1e8).toFixed(1).replace(/\.0$/, '') + '亿';
  if (n >= 1e4) return (n / 1e4).toFixed(1).replace(/\.0$/, '') + '万';
  return Number(n).toLocaleString('en-US');
}

/** 2026-10-09 -> 2026年10月9日 */
export const dateCN = (d: string | null | undefined): string =>
  String(d || '').replace(/^(\d+)-0?(\d+)-0?(\d+)$/, '$1年$2月$3日');

/** 2026-10-09 -> 10月9日 */
export const dateShort = (d: string | null | undefined): string =>
  String(d || '').replace(/^\d+-0?(\d+)-0?(\d+)$/, '$1月$2日');

export interface PostTime {
  ms: number;
  short: string;
  full: string;
}

const EMPTY_TIME: PostTime = { ms: 0, short: '', full: '' };
const timeCache = new Map<string, PostTime>();

/** exact post time from the X snowflake id: ms = (id >> 22) + 1288834974657; rendered in UTC+8 */
export function postTime(id: string): PostTime {
  const cached = timeCache.get(id);
  if (cached) return cached;
  let r = EMPTY_TIME;
  try {
    const ms = Number((BigInt(id) >> 22n) + 1288834974657n);
    if (ms > 1.2e12) {
      const d = new Date(ms + 8 * 3600e3);
      const p = (n: number) => String(n).padStart(2, '0');
      r = {
        ms,
        short: `${d.getUTCMonth() + 1}月${d.getUTCDate()}日 ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`,
        full: `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}（UTC+8）`,
      };
    }
  } catch {
    /* non-numeric id */
  }
  timeCache.set(id, r);
  return r;
}

const AVATAR_COLORS = [
  '#1d9bf0',
  '#f91880',
  '#00ba7c',
  '#7856ff',
  '#ff7a00',
  '#d4a000',
  '#e0245e',
  '#17bf63',
  '#794bc4',
  '#0f9d58',
];

export function avatarColor(handle: string): string {
  let h = 0;
  for (const c of handle) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length] as string;
}

/** generated_at "2026-10-10T08:50:00+08:00" -> "08:50" */
export function generatedClock(generatedAt: string | null | undefined): string {
  const gen = (generatedAt || '').replace('T', ' ').slice(0, 16);
  return gen.slice(11) || gen;
}
