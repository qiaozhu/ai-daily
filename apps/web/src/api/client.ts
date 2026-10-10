import type {
  DayDetail,
  DaysResponse,
  FavoriteAdded,
  FavoriteRemoved,
  FavoritesResponse,
  StoriesResponse,
  StoryDetail,
  StoryRelatedResponse,
  StoryTrendResponse,
  TrendsResponse,
} from '@ai-daily/shared';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...init });
  const j = (await r.json().catch(() => ({}))) as { error?: string };
  if (!r.ok) throw new ApiError(j.error || 'HTTP ' + r.status, r.status);
  return j as T;
}

const dayCache = new Map<string, Promise<DayDetail>>();

export const api = {
  days: () => request<DaysResponse>('/api/days'),
  /** cached per date for the lifetime of the page (failed requests are not cached) */
  day(date: string): Promise<DayDetail> {
    let p = dayCache.get(date);
    if (!p) {
      p = request<DayDetail>('/api/days/' + encodeURIComponent(date)).catch((e: unknown) => {
        dayCache.delete(date);
        throw e;
      });
      dayCache.set(date, p);
    }
    return p;
  },
  story: (id: string) => request<StoryDetail>('/api/stories/' + encodeURIComponent(id)),
  storyTrend: (id: string) => request<StoryTrendResponse>('/api/stories/' + encodeURIComponent(id) + '/trend'),
  storyRelated: (id: string) => request<StoryRelatedResponse>('/api/stories/' + encodeURIComponent(id) + '/related'),
  search: (q: string) => request<StoriesResponse>('/api/stories?q=' + encodeURIComponent(q)),
  trends: () => request<TrendsResponse>('/api/trends'),
  favorites: () => request<FavoritesResponse>('/api/favorites'),
  addFavorite: (id: string) =>
    request<FavoriteAdded>('/api/favorites', { method: 'POST', body: JSON.stringify({ story_id: id }) }),
  removeFavorite: (id: string) =>
    request<FavoriteRemoved>('/api/favorites/' + encodeURIComponent(id), { method: 'DELETE' }),
  exportUrl: '/api/export',
};
