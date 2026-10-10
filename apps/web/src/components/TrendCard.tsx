import type { TrendPoint } from '@ai-daily/shared';
import { dateShort } from '../lib/format.ts';
import { trendGeometry, TREND_H, TREND_W } from '../lib/trend.ts';
import { Icon } from './Icon.tsx';

/**
 * 热度走势 (hifi-v1 §2.5, visual spec §7): with >= 2 days of real heat, today's heat + change vs the previous
 * report day + a 2px brand line over an 18% -> 0 gradient; with one day, the "首次出现" block and no chart.
 * Window: the 30 days up to the story's date (PRD v6 F2, /api/stories/:id/trend).
 */
export function TrendCard({ points, heat }: { points: readonly TrendPoint[]; heat: number | null }) {
  const real = points.filter((p): p is TrendPoint & { heat: number } => typeof p.heat === 'number');
  if (real.length < 2) {
    return (
      <section className="flex items-center gap-3 rounded-card bg-surface p-4 shadow-card" data-trend="first">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-text">
          <Icon name="star" size={20} />
        </div>
        <div>
          <div className="text-subhead font-semibold">首次出现 · 热度 {heat ?? '–'}</div>
          <p className="text-footnote text-text-2">数据满两天后，这里显示近 30 天的热度走势</p>
        </div>
      </section>
    );
  }
  const cur = real[real.length - 1] as { date: string; heat: number };
  const prev = real[real.length - 2] as { date: string; heat: number };
  const delta = Math.round((cur.heat - prev.heat) * 10) / 10;
  const g = trendGeometry(real);
  const label = '热度走势：' + real.map((p) => `${dateShort(p.date)} ${p.heat}`).join('，');
  return (
    <section className="rounded-card bg-surface p-4 shadow-card" data-trend="chart" data-points={real.length}>
      <h2 className="mb-1 text-footnote font-semibold text-text-2">热度走势 · 近 30 天</h2>
      <div className="mb-2 flex items-baseline gap-2">
        <span className="text-title2">{cur.heat}</span>
        <span
          className={`text-footnote font-semibold ${delta > 0 ? 'text-up-text' : 'text-text-2'}`}
          data-delta={delta}
        >
          {delta > 0 ? `↑ ${delta}` : delta < 0 ? `↓ ${-delta}` : '持平'}
          <span className="font-normal text-text-2"> 较 {dateShort(prev.date)}</span>
        </span>
      </div>
      <svg
        viewBox={`0 0 ${TREND_W} ${TREND_H}`}
        preserveAspectRatio="none"
        className="block h-[88px] w-full"
        role="img"
        aria-label={label}
      >
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--ad-brand)" stopOpacity="0.18" />
            <stop offset="1" stopColor="var(--ad-brand)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={g.area} fill="url(#trendFill)" />
        <path
          d={g.line}
          fill="none"
          stroke="var(--ad-brand)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="mt-1 flex justify-between text-caption font-normal text-text-2">
        <span>{dateShort(real[0]?.date)}</span>
        <span>{dateShort(cur.date)}</span>
      </div>
    </section>
  );
}
