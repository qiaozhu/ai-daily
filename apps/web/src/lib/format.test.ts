import { describe, expect, it } from 'vitest';
import {
  avatarColor,
  dateCN,
  dateShort,
  formatCount,
  generatedClock,
  postTime,
  todayBJ,
  weekdayCN,
  dateSpacedCN,
} from './format.ts';
import { splitHighlights } from './highlight.ts';

describe('format', () => {
  it('formatCount', () => {
    expect(formatCount(null)).toBe('');
    expect(formatCount(999)).toBe('999');
    expect(formatCount(1234)).toBe('1,234');
    expect(formatCount(12000)).toBe('1.2万');
    expect(formatCount(10000)).toBe('1万');
    expect(formatCount(150000000)).toBe('1.5亿');
  });
  it('dates', () => {
    expect(dateCN('2026-10-09')).toBe('2026年10月9日');
    expect(dateShort('2026-01-05')).toBe('1月5日');
    expect(generatedClock('2026-10-10T08:50:12+08:00')).toBe('08:50');
  });
  it('postTime decodes X snowflake ids in UTC+8', () => {
    const t = postTime('1976000000000000000');
    expect(t.short).toMatch(/^\d+月\d+日 \d\d:\d\d$/);
    expect(t.full).toMatch(/（UTC\+8）$/);
    expect(postTime('not-a-number')).toEqual({ ms: 0, short: '', full: '' });
  });
  it('avatarColor is stable', () => {
    expect(avatarColor('OpenAI')).toBe(avatarColor('OpenAI'));
  });
});

describe('splitHighlights', () => {
  it('marks case-insensitive matches, keeps the rest', () => {
    expect(splitHighlights('Gemini and gemini', ['GEMINI'])).toEqual([
      { text: 'Gemini', match: true },
      { text: ' and ', match: false },
      { text: 'gemini', match: true },
    ]);
  });
  it('treats regex characters literally', () => {
    expect(splitHighlights('a.b axb', ['a.b'])).toEqual([
      { text: 'a.b', match: true },
      { text: ' axb', match: false },
    ]);
  });
  it('no terms -> one plain segment', () => {
    expect(splitHighlights('x', [])).toEqual([{ text: 'x', match: false }]);
  });
});

describe('v6 helpers', () => {
  it('weekdayCN', () => {
    expect(weekdayCN('2026-10-10')).toBe('星期六');
    expect(weekdayCN('2026-10-12')).toBe('星期一');
    expect(weekdayCN('nope')).toBe('');
  });
  it('todayBJ uses UTC+8', () => {
    expect(todayBJ(Date.parse('2026-10-09T16:30:00Z'))).toBe('2026-10-10');
    expect(todayBJ(Date.parse('2026-10-09T15:59:00Z'))).toBe('2026-10-09');
  });
});

describe('dateSpacedCN', () => {
  it('formats like "10 月 10 日"', () => {
    expect(dateSpacedCN('2026-10-10')).toBe('10 月 10 日');
    expect(dateSpacedCN('2026-01-05')).toBe('1 月 5 日');
  });
});
