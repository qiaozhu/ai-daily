import type { DayDetail, DaysResponse, DaySummary, HealthResponse } from '@ai-daily/shared';
import type { DayRow } from '../db/rows.ts';
import { SQL } from '../db/sql.ts';
import { parseJson } from '../lib/json.ts';
import { storiesOfDay } from './stories.ts';
import { withStreaks } from './streaks.ts';

export async function health(db: D1Database): Promise<HealthResponse> {
  const t = await db
    .prepare(SQL.health)
    .first<{ days: number; stories: number; posts: number; latest: string | null }>();
  return { ok: true, ...(t as NonNullable<typeof t>), time: new Date().toISOString() };
}

export async function listDays(db: D1Database): Promise<DaysResponse> {
  const { results } = await db.prepare(SQL.daysList).all<DaySummary>();
  return { days: results, latest: results[0] ? results[0].date : null };
}

export async function latestDate(db: D1Database): Promise<string | null> {
  return (await db.prepare(SQL.latestDate).first<{ d: string | null }>())?.d ?? null;
}

export const dayHeader = (d: DayRow): Omit<DayDetail, 'stories'> => ({
  date: d.date,
  generated_at: d.generated_at,
  timezone: d.timezone,
  source: d.source,
  highlights: parseJson<string[]>(d.highlights_json, []),
  data_quality_notes: parseJson<string[]>(d.data_quality_json, []),
});

/** null when the day does not exist */
export async function getDay(db: D1Database, date: string): Promise<DayDetail | null> {
  const d = await db.prepare(SQL.dayByDate).bind(date).first<DayRow>();
  if (!d) return null;
  return { ...dayHeader(d), stories: await withStreaks(db, date, await storiesOfDay(db, date)) };
}

export async function dayExists(db: D1Database, date: string): Promise<boolean> {
  return !!(await db.prepare(SQL.dayExists).bind(date).first());
}
