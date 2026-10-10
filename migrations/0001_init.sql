-- AI daily schema (D1 / SQLite). Mirrors /workspace/ai-daily-app/db.js
CREATE TABLE IF NOT EXISTS days (
  date TEXT PRIMARY KEY, generated_at TEXT, timezone TEXT, source TEXT,
  highlights_json TEXT NOT NULL DEFAULT '[]', data_quality_json TEXT NOT NULL DEFAULT '[]',
  imported_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS stories (
  id TEXT PRIMARY KEY, date TEXT NOT NULL REFERENCES days(date) ON DELETE CASCADE,
  rank INTEGER NOT NULL, headline_zh TEXT NOT NULL, summary_zh TEXT, why_it_matters TEXT,
  org_tag TEXT, category TEXT, categories_json TEXT NOT NULL DEFAULT '[]', tags_json TEXT NOT NULL DEFAULT '[]',
  heat REAL, news_refs_json TEXT NOT NULL DEFAULT '[]', data_quality TEXT);
CREATE INDEX IF NOT EXISTS idx_stories_date ON stories(date);
CREATE TABLE IF NOT EXISTS story_categories (
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE, category TEXT NOT NULL,
  PRIMARY KEY (story_id, category));
CREATE INDEX IF NOT EXISTS idx_sc_cat ON story_categories(category);
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT, story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL, handle TEXT NOT NULL, post_id TEXT, url TEXT NOT NULL, text TEXT, lang TEXT,
  translation_zh TEXT, likes INTEGER, reposts INTEGER, replies INTEGER, views INTEGER);
CREATE INDEX IF NOT EXISTS idx_posts_story ON posts(story_id);
-- favorites intentionally has no FK, so re-importing a day keeps favorites (story ids are stable)
CREATE TABLE IF NOT EXISTS favorites (story_id TEXT PRIMARY KEY, created_at TEXT NOT NULL);
