import type { DayStory, Story, TopicDay, TopicStory } from '@ai-daily/shared';
import { STREAK_LOOKBACK_DAYS, addDays, computeStreaks } from '@ai-daily/shared';
import { SQL } from '../db/sql.ts';
import { parseJson } from '../lib/json.ts';

/** earlier report days (with their stories' topics) within STREAK_LOOKBACK_DAYS before `date` */
export async function topicHistory(db: D1Database, date: string): Promise<TopicDay[]> {
  const from = addDays(date, -STREAK_LOOKBACK_DAYS);
  const [days, rows] = await db.batch([
    db.prepare(SQL.daysBetween).bind(date, from),
    db.prepare(SQL.storyTopicsBetween).bind(date, from),
  ]);
  const byDate = new Map<string, TopicStory[]>();
  for (const d of (days?.results ?? []) as { date: string }[]) byDate.set(d.date, []);
  for (const r of (rows?.results ?? []) as { id: string; date: string; tags_json: string | null }[]) {
    byDate.get(r.date)?.push({ id: r.id, topics: parseJson<string[]>(r.tags_json, []) });
  }
  return [...byDate].map(([d, stories]) => ({ date: d, stories }));
}

/** add the v6 `badge` / `streak_days` fields (PRD §3.1) to the stories of one day; legacy fields untouched */
export async function withStreaks(db: D1Database, date: string, stories: Story[]): Promise<DayStory[]> {
  if (!stories.length) return [];
  const info = computeStreaks(
    { date, stories: stories.map((s) => ({ id: s.id, topics: s.tags })) },
    await topicHistory(db, date),
  );
  return stories.map((s) => ({ ...s, ...(info.get(s.id) ?? { badge: null, streak_days: null }) }));
}
