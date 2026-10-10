import type { Story } from '@ai-daily/shared';

export type SortKey = 'rank' | 'heat';

/** default = editorial rank (PRD F1); 'heat' = heat desc, ties by rank */
export function sortStories<T extends Story>(list: readonly T[], key: SortKey): T[] {
  const out = [...list];
  if (key === 'heat') out.sort((a, b) => (b.heat ?? -1) - (a.heat ?? -1) || a.rank - b.rank);
  else out.sort((a, b) => a.rank - b.rank);
  return out;
}

/** desktop "热度榜": the n hottest stories */
export const topByHeat = <T extends Story>(list: readonly T[], n: number): T[] => sortStories(list, 'heat').slice(0, n);

/** heat bar width in % (0–100, null -> 0) */
export const heatPct = (heat: number | null | undefined): number => Math.max(0, Math.min(100, heat ?? 0));

/** "持续热议 3 天" / "新" / null */
export function badgeLabel(s: { badge?: 'new' | 'ongoing' | null; streak_days?: number | null }): string | null {
  if (s.badge === 'ongoing' && s.streak_days) return `持续热议 ${s.streak_days} 天`;
  if (s.badge === 'new') return '新';
  return null;
}
