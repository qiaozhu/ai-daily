import type { Story } from '@ai-daily/shared';

export interface CategoryCount {
  category: string;
  count: number;
}

/** categories in `pool`, most frequent first (stable for ties: first appearance) */
export function countCategories(pool: Story[]): CategoryCount[] {
  const counts = new Map<string, number>();
  for (const s of pool) for (const c of s.categories || []) counts.set(c, (counts.get(c) || 0) + 1);
  return [...counts].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count);
}

export const filterByCategory = (list: Story[], cat: string | null): Story[] =>
  cat ? list.filter((s) => (s.categories || []).includes(cat)) : list;

const PALETTE = [
  '#1d9bf0',
  '#00ba7c',
  '#f91880',
  '#7856ff',
  '#ff7a00',
  '#d4a000',
  '#06b6d4',
  '#ef4444',
  '#84cc16',
  '#64748b',
  '#ec4899',
  '#a16207',
];

/** stable colour per category, assigned in the given order */
export function categoryColors(categories: string[]): (c: string) => string {
  const order = [...categories];
  return (c) => {
    let i = order.indexOf(c);
    if (i < 0) i = order.push(c) - 1;
    return PALETTE[i % PALETTE.length] as string;
  };
}
