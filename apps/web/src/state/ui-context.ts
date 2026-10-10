import { createContext, useContext } from 'react';

export interface UiContextValue {
  /** favorited story ids (server-side favorites) */
  favs: ReadonlySet<string>;
  /** ids with a favorite request in flight (their star buttons are disabled) */
  pending: ReadonlySet<string>;
  toggleFav: (id: string) => void;
  /** search terms to highlight (only on the search view) */
  terms: string[];
}

export const UiContext = createContext<UiContextValue | null>(null);

export function useUi(): UiContextValue {
  const v = useContext(UiContext);
  if (!v) throw new Error('useUi() outside <UiContext>');
  return v;
}
