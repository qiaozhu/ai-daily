// A ~1 KB path router (replaces react-router: the whole app has 5 flat routes, see state/route.ts).
// The URL is the source of truth; components read it with useUrl() and change it with navigate().
import { useSyncExternalStore } from 'react';

const listeners = new Set<() => void>();

function subscribe(l: () => void) {
  listeners.add(l);
  window.addEventListener('popstate', l);
  return () => {
    listeners.delete(l);
    window.removeEventListener('popstate', l);
  };
}

const snapshot = () => location.pathname + location.search;

/** current "pathname?search" (re-renders on navigate() and back/forward) */
export const useUrl = (): string => useSyncExternalStore(subscribe, snapshot, snapshot);

export interface NavigateOptions {
  /** replace the history entry instead of pushing one (filters, search typing, redirects) */
  replace?: boolean;
  /** scroll to the top after navigating */
  top?: boolean;
}

let pushed = 0;
/** true when history.back() stays inside the app (at least one in-app navigate() pushed an entry) */
export const canGoBack = (): boolean => pushed > 0 && (history.state as { app?: number } | null)?.app !== undefined;

export function navigate(to: string, opts: NavigateOptions = {}) {
  if (to !== snapshot()) {
    if (opts.replace) history.replaceState(history.state, '', to);
    else history.pushState({ app: ++pushed }, '', to);
    for (const l of [...listeners]) l();
  }
  if (opts.top) window.scrollTo(0, 0);
}

/** click handler for <a href> that navigates in-app for plain left clicks (new tab etc. keep working) */
export function onLinkClick(e: React.MouseEvent<HTMLAnchorElement>, opts: NavigateOptions = { top: true }) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  navigate(e.currentTarget.getAttribute('href') || '/', opts);
}
