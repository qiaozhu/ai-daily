// Geometry of the 热度走势 line chart (components/TrendCard.tsx).

/** days between two YYYY-MM-DD dates */
const dayDiff = (a: string, b: string): number => (Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5;

export const TREND_W = 320;
export const TREND_H = 88;
const W = TREND_W;
const H = TREND_H;
const PAD = 6; // room for the 6px point markers (8px for the latest)

/** below this many points every point gets a marker (design: sparse data reads as dots, not a trend) */
export const DOTS_BELOW = 7;

/** SVG path of the line (x by calendar date, so days without a report leave a gap in x, not a fake point) */
export function trendGeometry(points: readonly { date: string; heat: number }[]) {
  const first = points[0]?.date ?? '';
  const span = Math.max(1, dayDiff(first, points[points.length - 1]?.date ?? first));
  const heats = points.map((p) => p.heat);
  const max = Math.max(...heats);
  const min = Math.min(...heats);
  const lo = Math.max(0, min - (max - min || max || 1) * 0.25);
  const hi = max + (max - lo) * 0.1 || 1;
  const xy = points.map((p) => {
    const x = PAD + (dayDiff(first, p.date) / span) * (W - 2 * PAD);
    const y = PAD + (1 - (p.heat - lo) / (hi - lo)) * (H - 2 * PAD);
    return [Math.round(x * 10) / 10, Math.round(y * 10) / 10] as const;
  });
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
  const last = xy[xy.length - 1] ?? [0, 0];
  const area = `${line} L${last[0]} ${H} L${xy[0]?.[0] ?? 0} ${H} Z`;
  return { line, area, last, xy };
}

/** the share card (竖版) of a story, served by the Worker (KV card or the default brand image) */
export const saveImageUrl = (id: string): string => `/og/story/${encodeURIComponent(id)}.png?size=portrait`;
