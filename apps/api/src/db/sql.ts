// All SQL in one place. Statements are byte-for-byte the legacy src/worker.js queries (same ordering/semantics).

export const STORY_SELECT =
  'SELECT s.*, (f.story_id IS NOT NULL) AS fav FROM stories s LEFT JOIN favorites f ON f.story_id=s.id';

export const SQL = {
  health:
    'SELECT (SELECT count(*) FROM days) days,(SELECT count(*) FROM stories) stories,(SELECT count(*) FROM posts) posts,(SELECT max(date) FROM days) latest',
  daysList:
    'SELECT d.date,d.generated_at,d.source,count(s.id) story_count FROM days d LEFT JOIN stories s ON s.date=d.date GROUP BY d.date ORDER BY d.date DESC',
  latestDate: 'SELECT max(date) d FROM days',
  dayByDate: 'SELECT * FROM days WHERE date=?',
  allDaysDesc: 'SELECT * FROM days ORDER BY date DESC',
  storiesOfDay: `${STORY_SELECT} WHERE s.date=? ORDER BY s.rank`,
  postsOfStories: `SELECT story_id,handle,post_id,url,text,lang,translation_zh,likes,reposts,replies,views FROM posts
     WHERE story_id IN (SELECT value FROM json_each(?)) ORDER BY story_id, rank`,
  trendsPerDay:
    'SELECT s.date, sc.category, count(*) n FROM stories s JOIN story_categories sc ON sc.story_id=s.id GROUP BY s.date, sc.category ORDER BY s.date',
  trendsDays:
    'SELECT d.date, count(s.id) n FROM days d LEFT JOIN stories s ON s.date=d.date GROUP BY d.date ORDER BY d.date',
  trendsCategoryTotals: 'SELECT category, count(*) n FROM story_categories GROUP BY category ORDER BY n DESC',
  trendsTags: 'SELECT date, tags_json, heat FROM stories',
  favoriteStories: `${STORY_SELECT} WHERE f.story_id IS NOT NULL ORDER BY f.created_at DESC`,
  favoritesExport: 'SELECT story_id, created_at FROM favorites ORDER BY created_at',
  storyExists: 'SELECT 1 FROM stories WHERE id=?',
  isFavorite: 'SELECT 1 FROM favorites WHERE story_id=?',
  favoritesCount: 'SELECT count(*) n FROM favorites',
  favoriteInsert: 'INSERT OR IGNORE INTO favorites(story_id,created_at) VALUES (?,?)',
  favoriteDelete: 'DELETE FROM favorites WHERE story_id=?',
} as const;

/** one search term = one bound parameter (D1 caps bound params at 100), used twice via ?N */
export const searchTermClause = (paramIndex: number): string =>
  `(instr(lower(s.headline_zh||' '||ifnull(s.summary_zh,'')||' '||ifnull(s.why_it_matters,'')||' '||ifnull(s.org_tag,'')||' '||s.tags_json||' '||s.categories_json), lower(?${paramIndex})) > 0
        OR s.id IN (SELECT story_id FROM posts WHERE instr(lower(handle||' '||ifnull(text,'')||' '||ifnull(translation_zh,'')), lower(?${paramIndex})) > 0))`;
