// Cross-day topic matching (PRD v6 §3.1) — shared by the API (F1 badges; later F2 trend/related, F5 weekly).
// Story ids differ every day, so stories are matched by their `topics` (stored as `tags`), never by id.
//
// 1. Broad topics never match:
//    - BROAD_TOPICS (below): organisations/companies, every category name, generic terms like 大模型;
//    - per day: a topic used by >= DAY_BROAD_MIN_STORIES stories *that day* is broad on that day only.
// 2. Today's story S and story T of an earlier report day D match when they share a topic that is not in the
//    blacklist and is broad neither today nor on D. D "has" S when any of its stories matches.
// 3. streak N counts report days only (days without a report are skipped, they do not break a streak):
//    walk back from today (N includes today) and stop at the first report day that does not have S.
// 4. N >= 2 -> 'ongoing'; N = 1 and no report day in the previous NEW_LOOKBACK_DAYS calendar days has S -> 'new';
//    otherwise no badge. A story without any specific topic gets no badge and streak_days = null.

/** Organisations / companies (topics that span unrelated stories). Matched case-insensitively. */
export const BROAD_ORG_TOPICS: readonly string[] = [
  'OpenAI',
  'Anthropic',
  'Google',
  'Google DeepMind',
  'DeepMind',
  '谷歌',
  'Meta',
  'Microsoft',
  '微软',
  'Apple',
  '苹果',
  'Amazon',
  '亚马逊',
  'NVIDIA',
  '英伟达',
  'xAI',
  '阿里巴巴',
  '阿里',
  '腾讯',
  '字节跳动',
  '百度',
  '华为',
];

/** Every category name used by the daily JSON (`categories`). */
export const CATEGORY_TOPICS: readonly string[] = [
  '大模型',
  '产品',
  '政策',
  '开源',
  '芯片',
  '安全',
  '科研',
  '融资',
  '就业',
  '中文圈',
];

/** Generic umbrella terms. */
export const GENERIC_TOPICS: readonly string[] = [
  'AI',
  '人工智能',
  'AGI',
  'LLM',
  '开源模型',
  'AI智能体',
  '智能体',
  'AI Agent',
  'AI安全',
];

/** The maintained blacklist (PRD §3.1 rule 1, first bullet). */
export const BROAD_TOPICS: readonly string[] = [...BROAD_ORG_TOPICS, ...CATEGORY_TOPICS, ...GENERIC_TOPICS];

/** a topic used by this many stories (or more) on one day is broad on that day */
export const DAY_BROAD_MIN_STORIES = 3;
/** "new" = not seen in the previous 30 calendar days */
export const NEW_LOOKBACK_DAYS = 30;
/** how far back (calendar days) the API loads history to count a streak */
export const STREAK_LOOKBACK_DAYS = 90;

export type Badge = 'new' | 'ongoing';

export interface StreakInfo {
  /** 'new' | 'ongoing' | null (no badge) */
  badge: Badge | null;
  /** consecutive report days incl. the story's own day; null when the story has no specific topic */
  streak_days: number | null;
}

export interface TopicStory {
  id: string;
  topics: readonly string[];
}

export interface TopicDay {
  date: string;
  stories: readonly TopicStory[];
}

export const normTopic = (t: string): string => t.trim().toLowerCase();

const BLACKLIST = new Set(BROAD_TOPICS.map(normTopic));

export const isBlacklisted = (topic: string): boolean => BLACKLIST.has(normTopic(topic));

/** normalised topics that are broad on this day: the blacklist hits plus topics used by >= 3 stories */
export function broadTopicsOfDay(stories: readonly TopicStory[]): Set<string> {
  const count = new Map<string, number>();
  for (const s of stories) {
    for (const t of new Set(s.topics.map(normTopic))) count.set(t, (count.get(t) || 0) + 1);
  }
  const broad = new Set<string>();
  for (const [t, n] of count) if (n >= DAY_BROAD_MIN_STORIES || BLACKLIST.has(t)) broad.add(t);
  return broad;
}

/** the story's specific (matchable) topics on a day whose broad set is `dayBroad` */
export function specificTopics(story: TopicStory, dayBroad: ReadonlySet<string>): Set<string> {
  const out = new Set<string>();
  for (const t of story.topics) {
    const n = normTopic(t);
    if (n && !dayBroad.has(n)) out.add(n);
  }
  return out;
}

/** all specific topics of one day (union over its stories) */
export function specificTopicsOfDay(day: TopicDay): Set<string> {
  const broad = broadTopicsOfDay(day.stories);
  const out = new Set<string>();
  for (const s of day.stories) for (const t of specificTopics(s, broad)) out.add(t);
  return out;
}

/** 'YYYY-MM-DD' minus n calendar days */
export function addDays(date: string, n: number): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Badges for every story of `day`.
 * @param history earlier report days (any order; days on/after `day.date` are ignored)
 */
export function computeStreaks(day: TopicDay, history: readonly TopicDay[]): Map<string, StreakInfo> {
  const past = history
    .filter((h) => h.date < day.date)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((h) => ({ date: h.date, topics: specificTopicsOfDay(h) }));
  const newSince = addDays(day.date, -NEW_LOOKBACK_DAYS);
  const broadToday = broadTopicsOfDay(day.stories);
  const out = new Map<string, StreakInfo>();
  for (const s of day.stories) {
    const mine = specificTopics(s, broadToday);
    if (!mine.size) {
      out.set(s.id, { badge: null, streak_days: null });
      continue;
    }
    const has = (topics: ReadonlySet<string>) => [...mine].some((t) => topics.has(t));
    let n = 1;
    for (const p of past) {
      if (!has(p.topics)) break;
      n++;
    }
    let badge: Badge | null = null;
    if (n >= 2) badge = 'ongoing';
    else if (!past.some((p) => p.date >= newSince && has(p.topics))) badge = 'new';
    out.set(s.id, { badge, streak_days: n });
  }
  return out;
}
