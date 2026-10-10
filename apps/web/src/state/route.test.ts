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
    expect(legacyHashToPath('#d=2026-10-09&c=%E8%8A%AF%E7%89%87')).toBe('/?d=2026-10-09&c=%E8%8A%AF%E7%89%87');
    expect(legacyHashToPath('#v=bogus')).toBe('/');
    expect(legacyHashToPath('#/search?q=x')).toBeNull();
    expect(legacyHashToPath('')).toBeNull();
  });
});
