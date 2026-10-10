import type { Story } from '@ai-daily/shared';
import { describe, expect, it } from 'vitest';
import { badgeLabel, heatPct, sortStories, topByHeat } from './stories.ts';

const st = (id: string, rank: number, heat: number | null) => ({ id, rank, heat }) as Story;

describe('story helpers', () => {
  const list = [st('a', 2, 50), st('b', 1, 10), st('c', 3, 50), st('d', 4, null)];
  it('sorts by rank by default and by heat on demand (ties by rank)', () => {
    expect(sortStories(list, 'rank').map((s) => s.id)).toEqual(['b', 'a', 'c', 'd']);
    expect(sortStories(list, 'heat').map((s) => s.id)).toEqual(['a', 'c', 'b', 'd']);
    expect(list.map((s) => s.id)).toEqual(['a', 'b', 'c', 'd']); // not mutated
  });
  it('topByHeat', () => {
    expect(topByHeat(list, 2).map((s) => s.id)).toEqual(['a', 'c']);
  });
  it('heatPct clamps', () => {
    expect(heatPct(71.4)).toBe(71.4);
    expect(heatPct(130)).toBe(100);
    expect(heatPct(null)).toBe(0);
  });
  it('badgeLabel', () => {
    expect(badgeLabel({ badge: 'ongoing', streak_days: 3 })).toBe('持续热议 3 天');
    expect(badgeLabel({ badge: 'new', streak_days: 1 })).toBe('新');
    expect(badgeLabel({ badge: null, streak_days: 1 })).toBeNull();
    expect(badgeLabel({})).toBeNull();
  });
});
