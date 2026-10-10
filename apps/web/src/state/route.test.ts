import { describe, expect, it } from 'vitest';
import { buildRoute, legacyHashToPath, parseRoute, pathToView } from './route.ts';

describe('route state', () => {
  it('pathToView', () => {
    expect(pathToView('/')).toBe('day');
    expect(pathToView('/search')).toBe('search');
    expect(pathToView('/trend/')).toBe('trend');
    expect(pathToView('/nope')).toBeNull();
  });
  it('round-trips', () => {
    const s = { view: 'search' as const, date: '2026-10-09', cat: '芯片', q: 'Gemini' };
    const { pathname, search } = buildRoute(s, '2026-10-10');
    expect(pathname).toBe('/search');
    expect(parseRoute(pathname, search)).toEqual(s);
  });
  it('omits the latest date and q outside search', () => {
    expect(buildRoute({ view: 'day', date: '2026-10-10', cat: null, q: 'x' }, '2026-10-10')).toEqual({
      pathname: '/',
      search: '',
    });
  });
  it('converts v5 hash links', () => {
    expect(legacyHashToPath('#v=search&q=Gemini')).toBe('/search?q=Gemini');
    expect(legacyHashToPath('#v=fav')).toBe('/fav');
    expect(legacyHashToPath('#v=trend&d=2026-10-09')).toBe('/trend?d=2026-10-09');
    expect(legacyHashToPath('#d=2026-10-09&c=%E8%8A%AF%E7%89%87')).toBe('/?d=2026-10-09&c=%E8%8A%AF%E7%89%87');
    expect(legacyHashToPath('#v=day&q=ignored')).toBe('/'); // q only belongs to search
    expect(legacyHashToPath('#v=bogus')).toBe('/');
  });
  it('converts interim hash-router links', () => {
    expect(legacyHashToPath('#/')).toBe('/');
    expect(legacyHashToPath('#/search?q=Gemini')).toBe('/search?q=Gemini');
    expect(legacyHashToPath('#/search?q=a%20b&c=x')).toBe('/search?c=x&q=a+b');
    expect(legacyHashToPath('#/fav')).toBe('/fav');
    expect(legacyHashToPath('#/?d=2026-10-09')).toBe('/?d=2026-10-09');
    expect(legacyHashToPath('#/nope?x=1')).toBe('/');
  });
  it('caps q at 100 chars', () => {
    expect(legacyHashToPath('#v=search&q=' + 'x'.repeat(300))).toBe('/search?q=' + 'x'.repeat(100));
  });
  it('leaves non-legacy hashes alone', () => {
    expect(legacyHashToPath('')).toBeNull();
    expect(legacyHashToPath('#')).toBeNull();
    expect(legacyHashToPath('#section-2')).toBeNull();
  });
});
