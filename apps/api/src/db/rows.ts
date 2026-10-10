// Row shapes of the D1 tables (migrations/0001_init.sql). The schema is owned by migrations/ — do not change here.

export interface DayRow {
  date: string;
  generated_at: string;
  timezone: string;
  source: string;
  highlights_json: string | null;
  data_quality_json: string | null;
}

export interface StoryRow {
  id: string;
  date: string;
  rank: number;
  headline_zh: string;
  summary_zh: string | null;
  why_it_matters: string | null;
  org_tag: string | null;
  category: string | null;
  categories_json: string | null;
  tags_json: string | null;
  heat: number | null;
  news_refs_json: string | null;
  data_quality: string | null;
  /** 1/0 from the favorites LEFT JOIN */
  fav: number;
}

export interface PostRow {
  story_id: string;
  handle: string;
  post_id: string;
  url: string;
  text: string | null;
  lang: string | null;
  translation_zh: string | null;
  likes: number | null;
  reposts: number | null;
  replies: number | null;
  views: number | null;
}
