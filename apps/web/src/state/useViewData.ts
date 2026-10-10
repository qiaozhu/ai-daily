import type { DayDetail, FavoritesResponse, StoriesResponse, TrendsResponse } from '@ai-daily/shared';
import { useEffect, useState } from 'react';
import { api } from '../api/client.ts';
import type { View } from './route.ts';

export type ViewData =
  | { kind: 'day'; day: DayDetail }
  | { kind: 'no-day' }
  | { kind: 'search'; q: string; result: StoriesResponse }
  | { kind: 'search-empty' }
  | { kind: 'fav'; result: FavoritesResponse }
  | { kind: 'trend'; result: TrendsResponse };

export type ViewState =
  { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: ViewData };

async function load(view: View, date: string | null, q: string): Promise<ViewData> {
  switch (view) {
    case 'day':
      return date ? { kind: 'day', day: await api.day(date) } : { kind: 'no-day' };
    case 'search':
      return q ? { kind: 'search', q, result: await api.search(q) } : { kind: 'search-empty' };
    case 'fav':
      return { kind: 'fav', result: await api.favorites() };
    case 'trend':
      return { kind: 'trend', result: await api.trends() };
  }
}

/**
 * Loads the data of the current view. Stale responses (the user navigated on) are dropped;
 * `reloadKey` forces a refetch (used after (un)favoriting on the favorites view).
 */
export function useViewData(
  enabled: boolean,
  view: View,
  date: string | null,
  q: string,
  reloadKey: number,
  onLoaded?: (data: ViewData) => void,
): ViewState {
  const key = `${view}|${date ?? ''}|${q}|${reloadKey}`;
  const [state, setState] = useState<{ key: string; value: ViewState }>({ key: '', value: { status: 'loading' } });

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    load(view, date, q).then(
      (data) => {
        if (!alive) return;
        onLoaded?.(data);
        setState({ key, value: { status: 'ready', data } });
      },
      (e: unknown) =>
        alive && setState({ key, value: { status: 'error', message: e instanceof Error ? e.message : String(e) } }),
    );
    return () => {
      alive = false;
    };
  }, [enabled, key, view, date, q, onLoaded]);

  // keep showing the previous view's content until the new one arrives would mix views; show loading instead
  return state.key === key ? state.value : { status: 'loading' };
}
