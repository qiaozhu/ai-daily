import { describe, expect, it } from 'vitest';
import {
  BROAD_TOPICS,
  CATEGORY_TOPICS,
  addDays,
  broadTopicsOfDay,
  computeStreaks,
  isBlacklisted,
  type TopicDay,
} from './streaks.ts';

const day = (date: string, ...stories: [string, string[]][]): TopicDay => ({
  date,
  stories: stories.map(([id, topics]) => ({ id, topics })),
});
const filler = (date: string) => day(date, [`${date}-other`, ['别的事']]);
const badgeOf = (d: TopicDay, history: TopicDay[], id: string) => computeStreaks(d, history).get(id);

describe('PRD v6 §3.1 acceptance examples', () => {
  it('10-08, 10-09, 10-10 all have Codex -> ongoing, 3 days', () => {
    const today = day('2026-10-10', ['s', ['Codex']]);
    const hist = [day('2026-10-08', ['a', ['Codex']]), day('2026-10-09', ['b', ['Codex', 'GPT-6']])];
    expect(badgeOf(today, hist, 's')).toEqual({ badge: 'ongoing', streak_days: 3 });
  });

  it('a day without a report (10-09) is skipped -> ongoing, 2 days', () => {
    const today = day('2026-10-10', ['s', ['Codex']]);
    expect(badgeOf(today, [day('2026-10-08', ['a', ['Codex']])], 's')).toEqual({ badge: 'ongoing', streak_days: 2 });
  });

  it('10-09 has a report without Codex -> N = 1, seen within 30 days -> no badge', () => {
    const today = day('2026-10-10', ['s', ['Codex']]);
    const hist = [day('2026-10-08', ['a', ['Codex']]), filler('2026-10-09')];
    expect(badgeOf(today, hist, 's')).toEqual({ badge: null, streak_days: 1 });
  });

  it('only broad topics (OpenAI, 大模型) -> no badge, streak unknown', () => {
    const today = day('2026-10-10', ['s', ['OpenAI', '大模型']]);
    const hist = [day('2026-10-09', ['a', ['OpenAI', '大模型']])];
    expect(badgeOf(today, hist, 's')).toEqual({ badge: null, streak_days: null });
  });

  it('a topic in 3 stories of the day (马斯克) is broad that day and does not match', () => {
    const today = day(
      '2026-10-10',
      ['s1', ['马斯克', 'Grok']],
      ['s2', ['马斯克', '特朗普']],
      ['s3', ['马斯克', 'SpaceX']],
    );
    const hist = [day('2026-10-09', ['a', ['马斯克']])];
    const r = computeStreaks(today, hist);
    expect(r.get('s1')).toEqual({ badge: 'new', streak_days: 1 });
    expect(r.get('s2')).toEqual({ badge: 'new', streak_days: 1 });
  });
});

describe('matching details', () => {
  it('a topic broad on the past day (3+ stories there) does not match either', () => {
    const today = day('2026-10-10', ['s', ['马斯克']]);
    const hist = [day('2026-10-09', ['a', ['马斯克']], ['b', ['马斯克']], ['c', ['马斯克']])];
    expect(badgeOf(today, hist, 's')).toEqual({ badge: 'new', streak_days: 1 });
  });

  it('first appearance -> new; nothing in the previous 30 days -> new even if seen earlier', () => {
    const today = day('2026-10-10', ['s', ['Sora']]);
    expect(badgeOf(today, [], 's')).toEqual({ badge: 'new', streak_days: 1 });
    expect(badgeOf(today, [day('2026-09-09', ['a', ['Sora']]), filler('2026-10-09')], 's')).toEqual({
      badge: 'new',
      streak_days: 1,
    });
    expect(badgeOf(today, [day('2026-09-10', ['a', ['Sora']]), filler('2026-10-09')], 's')).toEqual({
      badge: null,
      streak_days: 1,
    });
  });

  it('matching is case/whitespace-insensitive and ignores blacklisted words', () => {
    const today = day('2026-10-10', ['s', ['codex ', 'OpenAI']]);
    const hist = [day('2026-10-09', ['a', ['Codex']])];
    expect(badgeOf(today, hist, 's')).toEqual({ badge: 'ongoing', streak_days: 2 });
    expect(badgeOf(day('2026-10-10', ['s', ['OpenAI', 'X']]), [day('2026-10-09', ['a', ['openai']])], 's')).toEqual({
      badge: 'new',
      streak_days: 1,
    });
  });

  it('history on/after the day is ignored; streak stops at the first report day without the topic', () => {
    const today = day('2026-10-10', ['s', ['Codex']]);
    const hist = [
      day('2026-10-11', ['z', ['Codex']]),
      day('2026-10-09', ['a', ['Codex']]),
      filler('2026-10-08'),
      day('2026-10-07', ['b', ['Codex']]),
    ];
    expect(badgeOf(today, hist, 's')).toEqual({ badge: 'ongoing', streak_days: 2 });
  });

  it('a story with no topics at all -> no badge', () => {
    expect(badgeOf(day('2026-10-10', ['s', []]), [], 's')).toEqual({ badge: null, streak_days: null });
  });
});

describe('blacklist', () => {
  it('contains organisations, every category and the generic terms named in the PRD', () => {
    for (const t of ['OpenAI', 'Anthropic', 'Google', '大模型', '开源模型', 'AI智能体', 'AI安全', ...CATEGORY_TOPICS]) {
      expect(isBlacklisted(t)).toBe(true);
    }
    expect(BROAD_TOPICS).toContain('中文圈');
    expect(isBlacklisted('Codex')).toBe(false);
    expect(isBlacklisted(' openai ')).toBe(true);
  });
  it('broadTopicsOfDay counts each story once', () => {
    const b = broadTopicsOfDay([
      { id: 'a', topics: ['X', 'X'] },
      { id: 'b', topics: ['X'] },
    ]);
    expect(b.has('x')).toBe(false);
  });
  it('addDays', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-10-10', -30)).toBe('2026-09-10');
  });
});
