import type { TrendTopic, TrendsResponse } from '@ai-daily/shared';
import { SQL } from '../db/sql.ts';
import { parseJson } from '../lib/json.ts';

interface TagRow {
  date: string;
  tags_json: string | null;
  heat: number | null;
}

/** aggregate topics (story tags) across days; sorted by day_count, story_count, heat_sum (desc) */
export function aggregateTopics(rows: TagRow[]): TrendTopic[] {
  const acc: Record<string, { topic: string; days: Set<string>; stories: number; heat: number }> = {};
  for (const r of rows) {
    for (const t of parseJson<string[]>(r.tags_json, [])) {
      const o = (acc[t] ||= { topic: t, days: new Set(), stories: 0, heat: 0 });
      o.days.add(r.date);
      o.stories++;
      o.heat += r.heat || 0;
    }
  }
  return Object.values(acc)
    .map((o) => ({
      topic: o.topic,
      day_count: o.days.size,
      story_count: o.stories,
      last_seen: [...o.days].sort().pop() as string,
      heat_sum: Math.round(o.heat),
    }))
    .sort((a, b) => b.day_count - a.day_count || b.story_count - a.story_count || b.heat_sum - a.heat_sum);
}

export async function trends(db: D1Database): Promise<TrendsResponse> {
  const [perDay, days, totals, tagRows] = await db.batch([
    db.prepare(SQL.trendsPerDay),
    db.prepare(SQL.trendsDays),
    db.prepare(SQL.trendsCategoryTotals),
    db.prepare(SQL.trendsTags),
  ]);
  const topics = aggregateTopics((tagRows?.results ?? []) as TagRow[]);
  return {
    days: (days?.results ?? []) as TrendsResponse['days'],
    per_day: (perDay?.results ?? []) as TrendsResponse['per_day'],
    category_totals: (totals?.results ?? []) as TrendsResponse['category_totals'],
    topics,
    recurring_topics: topics.filter((t) => t.day_count >= 2),
  };
}
