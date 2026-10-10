import { describe, expect, it } from 'vitest';
import {
  DayParamSchema,
  FavoriteBodySchema,
  FavoriteIdParamSchema,
  isCalendarDate,
  MESSAGES,
  parseLimit,
  safeDecode,
  searchTerms,
  StoriesQuerySchema,
} from './schemas.ts';

const issue = (r: { success: boolean; error?: { issues: { message: string }[] } }) => r.error?.issues[0]?.message;

describe('safeDecode', () => {
  it('decodes valid percent-encoding', () => {
    expect(safeDecode('%E4%B8%AD%20a')).toEqual({ ok: true, value: '中 a' });
  });
  it.each(['%ZZ', '%', '%E4%B8', 'a%2'])('reports failure instead of throwing for %s', (s) => {
    expect(safeDecode(s)).toEqual({ ok: false });
  });
});

describe('isCalendarDate (MINOR-2, API side)', () => {
  it.each(['2026-10-10', '2024-02-29', '2026-12-31', '2026-01-01'])('accepts %s', (d) => {
    expect(isCalendarDate(d)).toBe(true);
  });
  it.each(['2026-13-45', '2026-02-30', '2025-02-29', '2026-00-10', '2026-10-00', '2026-1-1', '20261010', '', null])(
    'rejects %s',
    (d) => {
      expect(isCalendarDate(d)).toBe(false);
    },
  );
});

describe('DayParamSchema (/api/days/:date)', () => {
  it('latest', () => {
    expect(DayParamSchema.parse('latest')).toEqual({ kind: 'latest' });
    expect(DayParamSchema.parse('%6Catest')).toEqual({ kind: 'latest' }); // decoded first, like the legacy API
  });
  it('a real date', () => {
    expect(DayParamSchema.parse('2026-10-10')).toEqual({ kind: 'date', date: '2026-10-10' });
  });
  it('BUG-1: invalid percent-encoding -> validation error (400), not an exception (500)', () => {
    const r = DayParamSchema.safeParse('%ZZ');
    expect(r.success).toBe(false);
    expect(issue(r)).toBe(MESSAGES.badEncoding);
  });
  it.each(['abc', '20261010', "2026-10-10'%20OR%201=1", '2026-13-45', '2026-02-30'])(
    'malformed / impossible date %s -> legacy 400 message',
    (raw) => {
      const r = DayParamSchema.safeParse(raw);
      expect(r.success).toBe(false);
      expect(issue(r)).toBe('日期格式应为 YYYY-MM-DD');
    },
  );
});

describe('parseLimit (BUG-2)', () => {
  it.each([
    [null, 100],
    ['', 100],
    ['abc', 100],
    ['0', 100], // legacy: 0 is falsy -> default
    ['3', 3],
    ['-5', 1],
    ['99999', 200],
    ['1.5', 1], // legacy produced "LIMIT 1.5" -> SQL error -> 500
    ['0.5', 1],
    ['2.9', 2],
    ['199.99', 199],
    ['Infinity', 200],
    ['1e2', 100],
  ])('limit=%s -> %d', (raw, expected) => {
    const n = parseLimit(raw);
    expect(n).toBe(expected);
    expect(Number.isInteger(n)).toBe(true);
  });
});

describe('StoriesQuerySchema', () => {
  it('normalises like the legacy handler', () => {
    expect(
      StoriesQuerySchema.parse({ q: '  a b  ', category: ' 芯片 ', from: '2026-10-01', to: 'nope', limit: '1.5' }),
    ).toEqual({ q: 'a b', category: '芯片', from: '2026-10-01', to: null, limit: 1 });
  });
  it('q is capped at 100 chars, missing params get defaults', () => {
    const r = StoriesQuerySchema.parse({ q: 'x'.repeat(500), category: null, from: null, to: null, limit: null });
    expect(r.q).toHaveLength(100);
    expect(r).toMatchObject({ category: '', from: null, to: null, limit: 100 });
  });
  it('searchTerms: whitespace split, max 5', () => {
    expect(searchTerms('a  b c d e f g')).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(searchTerms('')).toEqual([]);
  });
});

describe('FavoriteBodySchema (legacy coercion)', () => {
  it.each([
    [{ story_id: 'abc' }, 'abc'],
    [{ story_id: 123 }, '123'],
    [{ story_id: '' }, ''],
    [{}, ''],
    [null, ''],
    ['str', ''],
    [[1, 2], ''],
    [{ story_id: 'x'.repeat(300) }, 'x'.repeat(200)],
  ])('%j -> %j', (body, id) => {
    expect(FavoriteBodySchema.parse(body)).toEqual({ story_id: id });
  });
});

describe('FavoriteIdParamSchema (BUG-3)', () => {
  it('decodes ids with quotes / unicode / slashes', () => {
    expect(FavoriteIdParamSchema.parse(encodeURIComponent("weird 'id'/中文"))).toBe("weird 'id'/中文");
  });
  it('invalid percent-encoding -> validation error', () => {
    expect(FavoriteIdParamSchema.safeParse('%ZZ').success).toBe(false);
  });
});
