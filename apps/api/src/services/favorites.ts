import type { ExportResponse, FavoritesResponse } from '@ai-daily/shared';
import type { DayRow, StoryRow } from '../db/rows.ts';
import { SQL } from '../db/sql.ts';
import { dayHeader } from './days.ts';
import { hydrate, storiesOfDay } from './stories.ts';

export async function listFavorites(db: D1Database): Promise<FavoritesResponse> {
  const { results } = await db.prepare(SQL.favoriteStories).all<StoryRow>();
  return { count: results.length, ids: results.map((r) => r.id), stories: await hydrate(db, results) };
}

export type AddFavoriteResult = 'added' | 'not_found' | 'cap_reached';

export async function addFavorite(db: D1Database, id: string, max: number): Promise<AddFavoriteResult> {
  if (!(await db.prepare(SQL.storyExists).bind(id).first())) return 'not_found';
  // already favorited -> idempotent success, even when the cap is reached (BUG-4)
  if (await db.prepare(SQL.isFavorite).bind(id).first()) return 'added';
  const n = (await db.prepare(SQL.favoritesCount).first<{ n: number }>())?.n ?? 0;
  if (n >= max) return 'cap_reached';
  await db.prepare(SQL.favoriteInsert).bind(id, new Date().toISOString()).run();
  return 'added';
}

export async function removeFavorite(db: D1Database, id: string): Promise<number> {
  const r = await db.prepare(SQL.favoriteDelete).bind(id).run();
  return r.meta.changes || 0;
}

export async function exportAll(db: D1Database): Promise<ExportResponse> {
  const { results: days } = await db.prepare(SQL.allDaysDesc).all<DayRow>();
  const out: ExportResponse['days'] = [];
  for (const d of days) {
    const stories = (await storiesOfDay(db, d.date)).map(({ favorited: _favorited, ...s }) => ({
      ...s,
      topics: s.tags,
    }));
    out.push({ ...dayHeader(d), stories });
  }
  const { results: favorites } = await db.prepare(SQL.favoritesExport).all<ExportResponse['favorites'][number]>();
  return { exported_at: new Date().toISOString(), days: out, favorites };
}
