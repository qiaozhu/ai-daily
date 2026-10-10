import { describe, expect, it } from 'vitest';
import { saveImageUrl, trendGeometry, TREND_H } from './trend.ts';

describe('trendGeometry', () => {
  it('x follows calendar days (a missing day leaves a gap), higher heat is higher up', () => {
    const g = trendGeometry([
      { date: '2026-10-01', heat: 10 },
      { date: '2026-10-02', heat: 20 },
      { date: '2026-10-05', heat: 40 },
    ]);
    const pts = [...g.line.matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) }));
    expect(pts).toHaveLength(3);
    const [a, b, c] = pts as [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }];
    expect((b.x - a.x) * 3).toBeCloseTo(c.x - b.x, 0);
    expect(a.y).toBeGreaterThan(b.y);
    expect(b.y).toBeGreaterThan(c.y);
    expect(g.area.endsWith('Z')).toBe(true);
    expect(g.area).toContain(` ${TREND_H} `);
  });
  it('flat line stays inside the box', () => {
    const g = trendGeometry([
      { date: '2026-10-01', heat: 0 },
      { date: '2026-10-02', heat: 0 },
    ]);
    expect(g.line).not.toMatch(/NaN|Infinity/);
  });
  it('returns one point per input for the markers', () => {
    const g = trendGeometry([
      { date: '2026-10-01', heat: 10 },
      { date: '2026-10-03', heat: 30 },
    ]);
    expect(g.xy).toHaveLength(2);
    expect(g.last).toEqual(g.xy[1]);
  });
  it('saveImageUrl', () => {
    expect(saveImageUrl('2026-10-10-a b')).toBe('/og/story/2026-10-10-a%20b.png?size=portrait');
  });
});
