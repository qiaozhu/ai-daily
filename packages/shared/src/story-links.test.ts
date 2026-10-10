import { describe, expect, it } from 'vitest';
import { RELATED_MAX, relatedStories, storyTrend, type LinkDay, type LinkStory } from './story-links.ts';

const st = (id: string, topics: string[], heat: number | null = 50, extra: Partial<LinkStory> = {}): LinkStory => ({
  id,
  topics,
  heat,
  headline_zh: `标题 ${id}`,
  ...extra,
});
const day = (date: string, ...stories: LinkStory[]): LinkDay => ({ date, stories });

describe('storyTrend (PRD F2 + §3.1)', () => {
  it('Codex on 10-08, 10-09, 10-10 -> 3 points, the highest matching heat of each day', () => {
    const today = day('2026-10-10', st('s', ['Codex'], 70));
    const hist = [
      day('2026-10-08', st('a', ['Codex', 'GPT-6'], 40), st('a2', ['codex'], 55), st('x', ['别的'], 99)),
      day('2026-10-09', st('b', ['Codex'], 60)),
    ];
    expect(storyTrend('s', today, hist)).toEqual([
      { date: '2026-10-08', heat: 55, story_id: 'a2' },
      { date: '2026-10-09', heat: 60, story_id: 'b' },
      { date: '2026-10-10', heat: 70, story_id: 's' },
    ]);
  });
  it('days without a report or without a match have no point (no fake values)', () => {
    const today = day('2026-10-10', st('s', ['Codex'], 70));
    const hist = [day('2026-10-07', st('a', ['Codex'], 30)), day('2026-10-09', st('b', ['别的'], 80))];
    expect(storyTrend('s', today, hist).map((p) => p.date)).toEqual(['2026-10-07', '2026-10-10']);
  });
  it('only the 30-day window before the story (incl. its day); later days are ignored', () => {
    const today = day('2026-10-10', st('s', ['Codex']));
    const hist = [
      day('2026-09-11', st('in', ['Codex'])),
      day('2026-09-10', st('out', ['Codex'])),
      day('2026-10-11', st('later', ['Codex'])),
    ];
    expect(storyTrend('s', today, hist).map((p) => p.story_id)).toEqual(['in', 's']);
  });
  it('first appearance -> a single point', () => {
    expect(storyTrend('s', day('2026-10-10', st('s', ['Codex'], 59)), [])).toEqual([
      { date: '2026-10-10', heat: 59, story_id: 's' },
    ]);
  });
  it('only broad topics -> a single point; broad-that-day topics do not match', () => {
    const hist = [day('2026-10-09', st('a', ['OpenAI'], 10), st('b', ['星舰']), st('c', ['星舰']), st('d', ['星舰']))];
    expect(storyTrend('s', day('2026-10-10', st('s', ['OpenAI', '大模型'])), hist)).toHaveLength(1);
    expect(storyTrend('s', day('2026-10-10', st('s', ['星舰'])), hist)).toHaveLength(1);
  });
  it('null heat stays null; unknown id -> []', () => {
    const hist = [day('2026-10-09', st('a', ['Codex'], null))];
    expect(storyTrend('s', day('2026-10-10', st('s', ['Codex'], null)), hist)).toEqual([
      { date: '2026-10-09', heat: null, story_id: 'a' },
      { date: '2026-10-10', heat: null, story_id: 's' },
    ]);
    expect(storyTrend('nope', day('2026-10-10', st('s', ['Codex'])), [])).toEqual([]);
  });
});

describe('relatedStories', () => {
  it('shares a specific topic; sorted by shared count desc, then date desc; spelled like the related story', () => {
    const today = day(
      '2026-10-10',
      st('s', ['Codex', 'GPT-6', 'Sora 3', 'OpenAI']),
      st('t1', ['Sora 3']),
      st('t0', ['别的']),
    );
    const hist = [day('2026-10-05', st('p', ['codex', 'GPT-6 ']))];
    expect(relatedStories('s', today, hist)).toEqual([
      { id: 'p', date: '2026-10-05', headline_zh: '标题 p', heat: 50, shared_topics: ['codex', 'GPT-6'] },
      { id: 't1', date: '2026-10-10', headline_zh: '标题 t1', heat: 50, shared_topics: ['Sora 3'] },
    ]);
  });
  it('one story per event: an older story matching a newer related story is dropped', () => {
    // (stories of different events that all share one topic with each other count as one event too)
    const today = day('2026-10-10', st('s', ['Codex', 'Sora 3']));
    const hist = [day('2026-10-09', st('n', ['Sora 3', '视频'])), day('2026-10-08', st('o', ['视频', 'Sora 3']))];
    expect(relatedStories('s', today, hist).map((r) => r.id)).toEqual(['n']);
  });
  it('blacklisted / broad topics never relate; 30-day window; at most 5', () => {
    const today = day('2026-10-10', st('s', ['Codex', 'OpenAI', ...Array.from({ length: 7 }, (_, i) => `话题${i}`)]));
    const hist = [
      day('2026-10-09', st('org', ['OpenAI'])),
      day('2026-09-10', st('old', ['Codex'])),
      ...Array.from({ length: 7 }, (_, i) => day(`2026-10-0${i + 1}`, st(`c${i}`, [`话题${i}`]))),
    ];
    const r = relatedStories('s', today, hist);
    expect(r.map((x) => x.id)).not.toContain('org');
    expect(r.map((x) => x.id)).not.toContain('old');
    expect(r).toHaveLength(RELATED_MAX);
  });
  it('no specific topic -> same org_tag in the last 7 days (newest first)', () => {
    const today = day(
      '2026-10-10',
      st('s', ['OpenAI', '大模型'], 50, { org_tag: 'OpenAI' }),
      st('t', ['x'], 50, { org_tag: 'openai' }),
    );
    const hist = [
      day('2026-10-04', st('in', ['y'], 50, { org_tag: 'OpenAI' })),
      day('2026-10-03', st('out', ['y'], 50, { org_tag: 'OpenAI' })),
      day('2026-10-05', st('other', ['y'], 50, { org_tag: 'Google' })),
    ];
    expect(relatedStories('s', today, hist).map((x) => [x.id, x.shared_topics])).toEqual([
      ['t', []],
      ['in', []],
    ]);
  });
  it('no topic and no org -> []; unknown id -> []', () => {
    expect(relatedStories('s', day('2026-10-10', st('s', [])), [])).toEqual([]);
    expect(relatedStories('nope', day('2026-10-10', st('s', ['Codex'])), [])).toEqual([]);
  });
});
