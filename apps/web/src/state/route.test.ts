import { describe, expect, it } from 'vitest';
import { buildPath, legacyHashToPath, parseRoute, type Route } from './route.ts';

const route = (pathname: string, search = ''): Route => {
  const p = parseRoute(pathname, search);
  if ('redirect' in p) throw new Error('unexpected redirect to ' + p.redirect);
  return p.route;
};
const redirect = (pathname: string, search = '') => {
  const p = parseRoute(pathname, search);
  return 'redirect' in p ? p.redirect : null;
};

describe('parseRoute / buildPath', () => {
  it('home and day pages', () => {
    expect(route('/')).toEqual({ page: 'day', date: null, cat: null });
    expect(route('/day/2026-10-09', '?c=%E8%8A%AF%E7%89%87')).toEqual({ page: 'day', date: '2026-10-09', cat: '芯片' });
    expect(route('/day/2026-10-09/')).toEqual({ page: 'day', date: '2026-10-09', cat: null });
    expect(buildPath({ page: 'day', date: '2026-10-09', cat: '芯片' }, '2026-10-10')).toBe(
      '/day/2026-10-09?c=%E8%8A%AF%E7%89%87',
    );
    // the latest day is always "/"
    expect(buildPath({ page: 'day', date: '2026-10-10', cat: null }, '2026-10-10')).toBe('/');
  });
  it('search, archive, me', () => {
    expect(route('/search', '?q=Gemini')).toEqual({ page: 'search', q: 'Gemini', cat: null });
    expect(route('/search', '?q=' + 'x'.repeat(150))).toMatchObject({ q: 'x'.repeat(100) });
    expect(buildPath({ page: 'search', q: 'a b', cat: null })).toBe('/search?q=a+b');
    expect(route('/archive')).toEqual({ page: 'archive', tab: 'daily' });
    expect(route('/archive', '?tab=daily')).toEqual({ page: 'archive', tab: 'daily' });
    expect(route('/archive', '?tab=trend')).toEqual({ page: 'archive', tab: 'trend' });
    expect(route('/archive', '?tab=bogus')).toEqual({ page: 'archive', tab: 'daily' });
    expect(buildPath({ page: 'archive', tab: 'daily' })).toBe('/archive');
    expect(buildPath({ page: 'archive', tab: 'weekly' })).toBe('/archive?tab=weekly');
    expect(route('/me')).toEqual({ page: 'me' });
  });
  it('story detail', () => {
    expect(route('/story/2026-10-10-xai-grok-bot')).toEqual({ page: 'story', id: '2026-10-10-xai-grok-bot' });
    expect(route('/story/2026-10-10-a%20b/')).toEqual({ page: 'story', id: '2026-10-10-a b' });
    expect(buildPath({ page: 'story', id: '2026-10-10-a b' })).toBe('/story/2026-10-10-a%20b');
    expect(redirect('/story')).toBe('/');
    expect(redirect('/story/a/b')).toBe('/');
  });
  it('round-trips', () => {
    for (const u of ['/', '/day/2026-10-09?c=x', '/search?q=Gemini&c=x', '/archive?tab=trend', '/me']) {
      const [p, s = ''] = u.split('?');
      expect(buildPath(route(p as string, s ? '?' + s : ''), '2026-10-10')).toBe(u);
    }
  });
  it('old URLs redirect to the new ones, keeping other query params', () => {
    expect(redirect('/', '?d=2026-10-09')).toBe('/day/2026-10-09');
    expect(redirect('/', '?d=2026-10-09&c=x')).toBe('/day/2026-10-09?c=x');
    expect(redirect('/trend')).toBe('/archive?tab=trend');
    expect(redirect('/trend', '?c=x&tab=daily')).toBe('/archive?tab=trend&c=x');
    expect(redirect('/fav')).toBe('/me');
    expect(redirect('/fav', '?utm=1')).toBe('/me?utm=1');
  });
  it('unknown paths redirect home', () => {
    expect(redirect('/nope')).toBe('/');
    expect(redirect('/stories/abc')).toBe('/');
  });
});

describe('legacyHashToPath (client-side replace: the server never sees the hash)', () => {
  it('rewrites v5 links (#v=…) to the new URLs', () => {
    expect(legacyHashToPath('#v=search&q=Gemini')).toBe('/search?q=Gemini');
    expect(legacyHashToPath('#v=fav')).toBe('/me');
    expect(legacyHashToPath('#v=trend&d=2026-10-09')).toBe('/archive?tab=trend');
    expect(legacyHashToPath('#d=2026-10-09&c=%E8%8A%AF%E7%89%87')).toBe('/day/2026-10-09?c=%E8%8A%AF%E7%89%87');
    expect(legacyHashToPath('#v=day&q=ignored')).toBe('/');
    expect(legacyHashToPath('#v=bogus')).toBe('/');
    expect(legacyHashToPath('#v=search&q=' + 'y'.repeat(150))).toBe('/search?q=' + 'y'.repeat(100));
  });
  it('rewrites the #15 hash-router links (#/…) to the new URLs', () => {
    expect(legacyHashToPath('#/')).toBe('/');
    expect(legacyHashToPath('#/search?q=Gemini')).toBe('/search?q=Gemini');
    expect(legacyHashToPath('#/search?q=a%20b&c=x')).toBe('/search?q=a+b&c=x');
    expect(legacyHashToPath('#/fav')).toBe('/me');
    expect(legacyHashToPath('#/trend')).toBe('/archive?tab=trend');
    expect(legacyHashToPath('#/?d=2026-10-09&c=x')).toBe('/day/2026-10-09?c=x');
    expect(legacyHashToPath('#/nope?x=1')).toBe('/');
  });
  it('leaves non-legacy hashes alone', () => {
    expect(legacyHashToPath('')).toBeNull();
    expect(legacyHashToPath('#')).toBeNull();
    expect(legacyHashToPath('#section-2')).toBeNull();
  });
});
