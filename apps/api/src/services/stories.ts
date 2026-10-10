import type { SourcePost, StoriesQuery, Story } from '@ai-daily/shared';
import { searchTerms } from '@ai-daily/shared';
import type { PostRow, StoryRow } from '../db/rows.ts';
import { SQL, STORY_SELECT, searchTermClause } from '../db/sql.ts';
import { parseJson } from '../lib/json.ts';

/** attach source posts (rank order) and decode the *_json columns */
export async function hydrate(db: D1Database, rows: StoryRow[]): Promise<Story[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const { results: posts } = await db.prepare(SQL.postsOfStories).bind(JSON.stringify(ids)).all<PostRow>();
  const byStory: Record<string, SourcePost[]> = {};
  for (const { story_id, ...post } of posts) (byStory[story_id] ||= []).push(post);
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    rank: r.rank,
    headline_zh: r.headline_zh,
    summary_zh: r.summary_zh,
    why_it_matters: r.why_it_matters,
    org_tag: r.org_tag,
    category: r.category,
    categories: parseJson<string[]>(r.categories_json, []),
    tags: parseJson<string[]>(r.tags_json, []),
    heat: r.heat,
    news_refs: parseJson<string[]>(r.news_refs_json, []),
    data_quality: r.data_quality,
    source_posts: byStory[r.id] || [],
    favorited: !!r.fav,
  }));
}

export async function storiesOfDay(db: D1Database, date: string): Promise<Story[]> {
  const { results } = await db.prepare(SQL.storiesOfDay).bind(date).all<StoryRow>();
  return hydrate(db, results);
}

/** full-text-ish search across stories and their posts; terms are AND-ed, matched literally (instr, not LIKE) */
export async function searchStories(db: D1Database, query: StoriesQuery): Promise<Story[]> {
  const where: string[] = [];
  const args: string[] = [];
  if (query.category) {
    where.push('s.id IN (SELECT story_id FROM story_categories WHERE category=?)');
    args.push(query.category);
  }
  if (query.from) {
    where.push('s.date>=?');
    args.push(query.from);
  }
  if (query.to) {
    where.push('s.date<=?');
    args.push(query.to);
  }
  for (const term of searchTerms(query.q)) {
    where.push(searchTermClause(args.length + 1));
    args.push(term);
  }
  // query.limit is a validated integer in [1, 200], safe to inline
  const sql = `${STORY_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY s.date DESC, s.rank LIMIT ${query.limit}`;
  const { results } = await db
    .prepare(sql)
    .bind(...args)
    .all<StoryRow>();
  return hydrate(db, results);
}
