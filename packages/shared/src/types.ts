// API response shapes. These mirror exactly what the legacy src/worker.js returned (field names, nullability);
// the black-box tests in tests/api/ pin them down, so do not rename fields here without a migration plan.

export interface SourcePost {
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
  /** optional display name (not stored today; the UI falls back to a static map / @handle) */
  name?: string;
}

export interface Story {
  id: string;
  date: string;
  rank: number;
  headline_zh: string;
  summary_zh: string | null;
  why_it_matters: string | null;
  org_tag: string | null;
  category: string | null;
  categories: string[];
  tags: string[];
  heat: number | null;
  news_refs: string[];
  data_quality: string | null;
  source_posts: SourcePost[];
  favorited: boolean;
}

/** a story inside /api/export: `tags` duplicated as `topics`, no `favorited` */
export type ExportStory = Omit<Story, 'favorited'> & { topics: string[] };

export interface DaySummary {
  date: string;
  generated_at: string;
  source: string;
  story_count: number;
}

export interface DaysResponse {
  days: DaySummary[];
  latest: string | null;
}

export interface DayDetail {
  date: string;
  generated_at: string;
  timezone: string;
  source: string;
  highlights: string[];
  data_quality_notes: string[];
  stories: Story[];
}

export interface HealthResponse {
  ok: true;
  days: number;
  stories: number;
  posts: number;
  latest: string | null;
  time: string;
}

export interface StoriesResponse {
  count: number;
  stories: Story[];
}

export interface TrendTopic {
  topic: string;
  day_count: number;
  story_count: number;
  last_seen: string;
  heat_sum: number;
}

export interface TrendsResponse {
  days: { date: string; n: number }[];
  per_day: { date: string; category: string; n: number }[];
  category_totals: { category: string; n: number }[];
  topics: TrendTopic[];
  recurring_topics: TrendTopic[];
}

export interface FavoritesResponse {
  count: number;
  ids: string[];
  stories: Story[];
}

export interface FavoriteAdded {
  ok: true;
  story_id: string;
  favorited: true;
}

export interface FavoriteRemoved {
  ok: true;
  story_id: string;
  removed: number;
}

export interface ExportResponse {
  exported_at: string;
  days: (Omit<DayDetail, 'stories'> & { stories: ExportStory[] })[];
  favorites: { story_id: string; created_at: string }[];
}

export interface ApiError {
  error: string;
}
