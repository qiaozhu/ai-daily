// v6 F2 (PRD §3.2): story detail, heat trend and related stories. Matching = packages/shared (streaks.ts,
// story-links.ts), the same rules as the F1 badges. Read-only, new endpoints only.
import type { LinkDay, StoryDetail, StoryRelatedResponse, StoryTrendResponse } from '@ai-daily/shared';
import { RELATED_DAYS, TREND_DAYS, addDays, computeStreaks, relatedStories, storyTrend } from '@ai-daily/shared';
import type { StoryRow } from '../db/rows.ts';
import { SQL } from '../db/sql.ts';
import { parseJson } from '../lib/json.ts';
import { hydrate } from './stories.ts';
import { topicHistory } from './streaks.ts';

/** null when the id does not exist */
export async function getStory(db: D1Database, id: string): Promise<StoryDetail | null> {
  const row = await db.prepare(SQL.storyById).bind(id).first<StoryRow>();
  if (!row) return null;
  const [story] = await hydrate(db, [row]);
  if (!story) return null;
  const [sameDay, history] = await Promise.all([linkDays(db, row.date, row.date), topicHistory(db, row.date)]);
  const day = sameDay[0] ?? { date: row.date, stories: [] };
  const info = computeStreaks(day, history).get(id) ?? { badge: null, streak_days: null };
  return { ...story, ...info };
}

/** report days in [from, to] with their stories' topics / heat, newest first */
async function linkDays(db: D1Database, to: string, from: string): Promise<LinkDay[]> {
  const { results } = await db.prepare(SQL.storyLinksBetween).bind(to, from).all<{
    id: string;
    date: string;
    rank: number;
    headline_zh: string;
    org_tag: string | null;
    heat: number | null;
    tags_json: string | null;
  }>();
  const byDate = new Map<string, LinkDay['stories'][number][]>();
  for (const r of results) {
    const list = byDate.get(r.date) ?? [];
    list.push({
      id: r.id,
      rank: r.rank,
      headline_zh: r.headline_zh,
      org_tag: r.org_tag,
      heat: r.heat,
      topics: parseJson<string[]>(r.tags_json, []),
    });
    byDate.set(r.date, list);
  }
  return [...byDate].map(([date, stories]) => ({ date, stories }));
}

/** the story's date, or null when the id does not exist */
async function dateOf(db: D1Database, id: string): Promise<string | null> {
  return (await db.prepare(SQL.storyDate).bind(id).first<{ date: string }>())?.date ?? null;
}

async function window(db: D1Database, id: string, days: number) {
  const date = await dateOf(db, id);
  if (!date) return null;
  const all = await linkDays(db, date, addDays(date, -(days - 1)));
  const day = all.find((d) => d.date === date) ?? { date, stories: [] };
  return { day, history: all.filter((d) => d.date !== date) };
}

export async function getTrend(db: D1Database, id: string): Promise<StoryTrendResponse | null> {
  const w = await window(db, id, TREND_DAYS);
  return w && { points: storyTrend(id, w.day, w.history) };
}

export async function getRelated(db: D1Database, id: string): Promise<StoryRelatedResponse | null> {
  const w = await window(db, id, RELATED_DAYS);
  return w && { stories: relatedStories(id, w.day, w.history) };
}
