// URL <-> UI state (path routes, served by the Worker's SPA fallback):
//   /                         today (latest)          /?d=2026-10-09&c=芯片
//   /search?q=Gemini          /fav                    /trend
// Old links are rewritten once on startup by legacyHashToPath():
//   v5      #v=search&q=…&d=…&c=…   ->  /search?q=…&d=…&c=…
//   v6-dev  #/search?q=…            ->  /search?q=…

export type View = 'day' | 'search' | 'fav' | 'trend';

export const VIEWS: readonly View[] = ['day', 'search', 'fav', 'trend'];

const VIEW_PATH: Record<View, string> = { day: '/', search: '/search', fav: '/fav', trend: '/trend' };

export const VIEW_TITLE: Record<View, string> = { day: 'AI 热点日报', search: '搜索', fav: '收藏', trend: '趋势' };

export interface RouteState {
  view: View;
  /** explicit date from the URL (validated against the day list by the caller) */
  date: string | null;
  cat: string | null;
  q: string;
}

/** null when the path is not one of ours */
export function pathToView(pathname: string): View | null {
  const p = pathname.replace(/\/+$/, '') || '/';
  return (Object.keys(VIEW_PATH) as View[]).find((v) => VIEW_PATH[v] === p) ?? null;
}

export function parseRoute(pathname: string, search: string): RouteState {
  const sp = new URLSearchParams(search);
  const view = pathToView(pathname) ?? 'day';
  return {
    view,
    date: sp.get('d') || null,
    cat: sp.get('c') || null,
    q: view === 'search' ? (sp.get('q') || '').slice(0, 100) : '',
  };
}

/** `latest` is omitted from the URL so "#/" always means "newest day" */
export function buildRoute(s: RouteState, latest: string | null): { pathname: string; search: string } {
  const sp = new URLSearchParams();
  if (s.date && s.date !== latest) sp.set('d', s.date);
  if (s.cat) sp.set('c', s.cat);
  if (s.view === 'search' && s.q) sp.set('q', s.q);
  const qs = sp.toString();
  return { pathname: VIEW_PATH[s.view], search: qs ? '?' + qs : '' };
}

/**
 * Legacy hash link -> path URL ("/search?q=x"), or null when `hash` is not a legacy link.
 * Handles v5 query-style hashes (#v=search&q=x) and the interim hash-router form (#/search?q=x).
 * Unknown views fall back to "/" and only the known params (d, c, q) are kept.
 */
export function legacyHashToPath(hash: string): string | null {
  const h = hash.replace(/^#/, '');
  if (!h) return null;
  let view: View;
  let sp: URLSearchParams;
  if (h.startsWith('/')) {
    const qi = h.indexOf('?');
    view = pathToView(qi < 0 ? h : h.slice(0, qi)) ?? 'day';
    sp = new URLSearchParams(qi < 0 ? '' : h.slice(qi + 1));
  } else {
    sp = new URLSearchParams(h);
    if (!['v', 'd', 'c', 'q'].some((k) => sp.has(k))) return null; // a plain in-page anchor, leave it alone
    const v = sp.get('v');
    view = VIEWS.includes(v as View) ? (v as View) : 'day';
  }
  const r = buildRoute({ view, date: sp.get('d'), cat: sp.get('c'), q: (sp.get('q') || '').slice(0, 100) }, null);
  return r.pathname + r.search;
}
