import { describe, expect, it } from 'vitest';
import { cardKey, parseCardPath } from '../routes/og.ts';
import { dateCN, dayOg, storyFromPath, storyOg } from '../routes/pages.ts';
import { clip, escapeAttr, ogTags } from './og.ts';

describe('og helpers', () => {
  it('escapeAttr escapes the five HTML specials', () => {
    expect(escapeAttr(`a&b<c>"d'`)).toBe('a&amp;b&lt;c&gt;&quot;d&#39;');
  });
  it('clip collapses whitespace and cuts by code point', () => {
    expect(clip(' a \n b ', 10)).toBe('a b');
    expect(clip('🚀🚀🚀🚀', 3)).toBe('🚀🚀…');
    expect(clip(null, 5)).toBe('');
  });
  it('ogTags has the required tags, escaped', () => {
    const html = ogTags({
      title: 'T"<',
      description: 'D',
      url: 'https://x/story/a',
      image: 'https://x/og/story/a.png',
      type: 'article',
    });
    expect(html).toContain('<meta property="og:title" content="T&quot;&lt;">');
    expect(html).toContain('<meta property="og:image" content="https://x/og/story/a.png">');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(html).not.toContain('name="description"');
  });
  it('dayOg / storyOg', () => {
    expect(dateCN('2026-01-05')).toBe('1月5日');
    const d = dayOg('https://h', { date: '2026-10-10', highlights_json: '["一","二","三","四"]' });
    expect(d).toMatchObject({
      title: '10月10日 AI 热点 · AI 热点日报',
      description: '一；二；三',
      image: 'https://h/og/day/2026-10-10.png',
    });
    expect(dayOg('https://h', { date: '2026-10-10', highlights_json: null }).description).toBe(
      '10月10日的 AI 热点日报',
    );
    const s = storyOg('https://h', { id: '2026-10-10-a b', headline_zh: 'H', summary_zh: '' });
    expect(s).toMatchObject({
      description: 'H',
      url: 'https://h/story/2026-10-10-a%20b',
      image: 'https://h/og/story/2026-10-10-a%20b.png',
    });
  });
  it('storyFromPath / parseCardPath', () => {
    expect(storyFromPath('/story/2026-10-10-x')).toBe('2026-10-10-x');
    expect(storyFromPath('/story/2026-10-10-x/')).toBe('2026-10-10-x');
    expect(storyFromPath('/story/x')).toBeNull();
    expect(storyFromPath('/story/%ZZ')).toBeNull();
    expect(parseCardPath('/og/day/2026-10-10.png')).toEqual({ kind: 'day', key: '2026-10-10' });
    expect(parseCardPath('/og/story/2026-10-10-x.png')).toEqual({ kind: 'story', key: '2026-10-10-x' });
    expect(parseCardPath('/og/day/2026-02-30.png')).toBeNull();
    expect(parseCardPath('/og/story/2026-10-10-x.jpg')).toBeNull();
    expect(parseCardPath('/og/other/2026-10-10.png')).toBeNull();
  });
  it('KV keys match packages/share-card (and #22 prerender script)', () => {
    expect(cardKey('story', '2026-10-10-x', 'save')).toBe('card/story/2026-10-10-x/save.png');
    // same literal as packages/share-card/src/index.test.ts (the api Worker does not import share-card: node:zlib)
    expect(cardKey('day', '2026-10-10', 'og')).toBe('card/day/2026-10-10/og.png');
  });
});
