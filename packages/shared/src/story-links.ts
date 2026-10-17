// Cross-day links of one story (PRD v6 F2, built on the §3.1 matching rules in streaks.ts):
//   storyTrend()     — heat per report day over the last TREND_DAYS calendar days (incl. the story's own day);
//                      on each day the heat is the highest `heat` among the stories that match. Days without a
//                      report, or where nothing matches, have no point (no fake values). 1 point = "首次出现".
//   relatedStories() — other stories of the last RELATED_DAYS days that share a specific topic, one per event
//                      (the newest day of it), sorted by number of shared topics desc, then date desc; max 5.
//                      A story without any specific topic falls back to the same org_tag in the last 7 days.
import { addDays, broadTopicsOfDay, normTopic, specificTopics, type TopicStory } from './streaks.ts';

export const TREND_DAYS = 30;
export const RELATED_DAYS = 30;
export const RELATED_ORG_DAYS = 7;
export const RELATED_MAX = 5;

export interface LinkStory extends TopicStory {
  rank?: number;
  heat: number | null;
  headline_zh: string;
  org_tag?: string | null;
}

export interface LinkDay {
  date: string;
  stories: readonly LinkStory[];
}

export interface TrendPoint {
  date: string;
  heat: number | null;
  story_id: string;
}

export interface RelatedStory {
  id: string;
  date: string;
  headline_zh: string;
  heat: number | null;
  /** shared specific topics, spelled as in the related story; [] for the org_tag fallback */
  shared_topics: string[];
}

const byHeatDesc = (a: LinkStory, b: LinkStory) =>
  (b.heat ?? -1) - (a.heat ?? -1) || (a.rank ?? 0) - (b.rank ?? 0) || (a.id < b.id ? -1 : 1);

/** the story's own specific topics on its day (empty when it only has broad topics) */
function ownTopics(storyId: string, day: LinkDay): { story: LinkStory; mine: Set<string> } | null {
  const story = day.stories.find((s) => s.id === storyId);
  if (!story) return null;
  return { story, mine: specificTopics(story, broadTopicsOfDay(day.stories)) };
}

/**
 * Heat trend of `storyId` (a story of `day`), oldest first.
 * @param history other report days (any order; only those in the TREND_DAYS window before `day` are used)
 */
export function storyTrend(storyId: string, day: LinkDay, history: readonly LinkDay[]): TrendPoint[] {
  const own = ownTopics(storyId, day);
  if (!own) return [];
  const points: TrendPoint[] = [{ date: day.date, heat: own.story.heat, story_id: own.story.id }];
  if (own.mine.size) {
    const from = addDays(day.date, -(TREND_DAYS - 1));
    for (const h of history) {
      if (h.date >= day.date || h.date < from) continue;
      const broad = broadTopicsOfDay(h.stories);
      const matched = h.stories.filter((t) => [...specificTopics(t, broad)].some((x) => own.mine.has(x)));
      const best = [...matched].sort(byHeatDesc)[0];
      if (best) points.push({ date: h.date, heat: best.heat, story_id: best.id });
    }
  }
  return points.sort((a, b) => (a.date < b.date ? -1 : 1));
}

/**
 * Related stories of `storyId` (a story of `day`).
 * @param history other report days (any order); only RELATED_DAYS (topics) / RELATED_ORG_DAYS (org) before `day`
 */
export function relatedStories(storyId: string, day: LinkDay, history: readonly LinkDay[]): RelatedStory[] {
  const own = ownTopics(storyId, day);
  if (!own) return [];
  const days = [day, ...history.filter((h) => h.date < day.date)];

  if (!own.mine.size) {
    const org = normTopic(own.story.org_tag || '');
    if (!org) return [];
    const from = addDays(day.date, -(RELATED_ORG_DAYS - 1));
    return days
      .filter((d) => d.date >= from)
      .flatMap((d) =>
        d.stories.filter((s) => s.id !== storyId && normTopic(s.org_tag || '') === org).map((s) => ({ d, s })),
      )
      .sort((a, b) => (a.d.date === b.d.date ? byHeatDesc(a.s, b.s) : a.d.date < b.d.date ? 1 : -1))
      .slice(0, RELATED_MAX)
      .map(({ d, s }) => ({ id: s.id, date: d.date, headline_zh: s.headline_zh, heat: s.heat, shared_topics: [] }));
  }

  // candidates: every other story in the window sharing >= 1 specific topic (valid on both days)
  const from = addDays(day.date, -(RELATED_DAYS - 1));
  const cands: { date: string; s: LinkStory; topics: Set<string>; shared: string[] }[] = [];
  for (const d of days) {
    if (d.date < from) continue;
    const broad = broadTopicsOfDay(d.stories);
    for (const s of d.stories) {
      if (s.id === storyId) continue;
      const topics = specificTopics(s, broad);
      const sharedNorm = [...topics].filter((t) => own.mine.has(t));
      if (!sharedNorm.length) continue;
      const shared = [...new Set(s.topics.filter((t) => sharedNorm.includes(normTopic(t))).map((t) => t.trim()))];
      cands.push({ date: d.date, s, topics, shared });
    }
  }
  // one per event: newest day first; a candidate from an older day that shares a specific topic with an already
  // kept candidate of a newer day is the same event -> dropped (stories of the same day are distinct events)
  cands.sort((a, b) => (a.date === b.date ? byHeatDesc(a.s, b.s) : a.date < b.date ? 1 : -1));
  const kept: typeof cands = [];
  for (const c of cands) {
    if (kept.some((k) => k.date > c.date && [...c.topics].some((t) => k.topics.has(t)))) continue;
    kept.push(c);
  }
  return kept
    .sort(
      (a, b) =>
        b.shared.length - a.shared.length || (a.date === b.date ? byHeatDesc(a.s, b.s) : a.date < b.date ? 1 : -1),
    )
    .slice(0, RELATED_MAX)
    .map((c) => ({ id: c.s.id, date: c.date, headline_zh: c.s.headline_zh, heat: c.s.heat, shared_topics: c.shared }));
}
