// URL <-> page state. Path routes (PRD v6 §3.0), served by the Worker's SPA fallback:
//   /                    今日 (latest day)          /day/2026-10-09      a given day      (?c=分类 on both)
//   /search?q=Gemini     搜索 (?c= too)             /archive[?tab=daily|trend|weekly]     往期
//   /me                  我的 (收藏、关注、设置)
//   /story/<id>          话题详情 (F2; the Worker answers 404 for an unknown id and adds og tags for a known one)
// Old URLs (product decision, F1):
//   /?d=D[&c=…] -> /day/D[?c=…]   /trend -> /archive?tab=trend   /fav -> /me   (other query params kept)
//   The Worker answers /trend and /fav with a 301 (apps/api/src/routes/pages.ts). `/?d=` cannot be: `/` is a
//   static, cached asset (run_worker_first cannot match a query string), so parseRoute() redirects it here.
//   Old hash links (#v=… from v5, #/… from #15) never reach the server: legacyHashToPath() rewrites them
//   on startup with history.replaceState (not an HTTP 301).

export type ArchiveTab = 'daily' | 'trend' | 'weekly';

export type Route =
  | { page: 'day'; date: string | null; cat: string | null }
  | { page: 'search'; q: string; cat: string | null }
  | { page: 'archive'; tab: ArchiveTab }
  | { page: 'me' }
  | { page: 'story'; id: string };

export type Page = Route['page'];

/** pages that own a tab (the story page belongs to none) */
export type TabPage = Exclude<Page, 'story'>;

/** the 4 tabs of the bottom bar / side nav */
export const TABS: readonly { page: TabPage; label: string; path: string }[] = [
  { page: 'day', label: '今日', path: '/' },
  { page: 'archive', label: '往期', path: '/archive' },
  { page: 'search', label: '搜索', path: '/search' },
  { page: 'me', label: '我的', path: '/me' },
];

export const Q_MAX = 100;
const DAY_PATH = /^\/day\/([^/]+)$/;
const STORY_PATH = /^\/story\/([^/]+)$/;
const ARCHIVE_TABS: readonly ArchiveTab[] = ['daily', 'trend', 'weekly'];

const qs = (pairs: [string, string | null | undefined][]): string => {
  const sp = new URLSearchParams();
  for (const [k, v] of pairs) if (v) sp.set(k, v);
  const s = sp.toString();
  return s ? '?' + s : '';
};

/** canonical URL of a route; the latest day is plain "/" */
export function buildPath(r: Route, latest: string | null = null): string {
  switch (r.page) {
    case 'day':
      return (r.date && r.date !== latest ? '/day/' + r.date : '/') + qs([['c', r.cat]]);
    case 'search':
      return (
        '/search' +
        qs([
          ['q', r.q.slice(0, Q_MAX)],
          ['c', r.cat],
        ])
      );
    case 'archive':
      return '/archive' + qs([['tab', r.tab === 'daily' ? null : r.tab]]);
    case 'me':
      return '/me';
    case 'story':
      return storyPath(r.id);
  }
}

export const storyPath = (id: string): string => '/story/' + encodeURIComponent(id);

/** `path` (may have a query) + the params of `sp` except `drop` and those `path` already sets */
function withQuery(path: string, sp: URLSearchParams, drop: string[]): string {
  const [base, q = ''] = path.split('?') as [string, string?];
  const out = new URLSearchParams(q);
  for (const [k, v] of sp) if (!drop.includes(k) && !out.has(k)) out.append(k, v);
  const s = out.toString();
  return base + (s ? '?' + s : '');
}

export type Parsed = { route: Route } | { redirect: string };

/** route of a URL, or the URL to redirect to (legacy and unknown paths) */
export function parseRoute(pathname: string, search: string): Parsed {
  const p = pathname.replace(/\/+$/, '') || '/';
  const sp = new URLSearchParams(search);
  const cat = sp.get('c') || null;
  if (p === '/') {
    const d = sp.get('d');
    if (d) return { redirect: withQuery('/day/' + encodeURIComponent(d), sp, ['d']) };
    return { route: { page: 'day', date: null, cat } };
  }
  const m = DAY_PATH.exec(p);
  if (m) return { route: { page: 'day', date: decodeURIComponentSafe(m[1] as string), cat } };
  const st = STORY_PATH.exec(p);
  if (st) return { route: { page: 'story', id: decodeURIComponentSafe(st[1] as string) } };
  if (p === '/search') return { route: { page: 'search', q: (sp.get('q') || '').slice(0, Q_MAX), cat } };
  if (p === '/archive') {
    const t = sp.get('tab') as ArchiveTab | null;
    return { route: { page: 'archive', tab: t && ARCHIVE_TABS.includes(t) ? t : 'daily' } };
  }
  if (p === '/me') return { route: { page: 'me' } };
  // old #15 URLs (the Worker already 301s these; kept for the dev server / cached shells)
  if (p === '/trend') return { redirect: withQuery('/archive?tab=trend', sp, ['tab']) };
  if (p === '/fav') return { redirect: withQuery('/me', sp, []) };
  return { redirect: '/' };
}

function decodeURIComponentSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

const V5_VIEWS = ['day', 'search', 'fav', 'trend'];

/** follow parseRoute() redirects to the final new-style URL */
function resolve(path: string, search: string): string {
  for (let i = 0; i < 3; i++) {
    const r = parseRoute(path, search);
    if (!('redirect' in r)) return buildPath(r.route);
    const qi = r.redirect.indexOf('?');
    path = qi < 0 ? r.redirect : r.redirect.slice(0, qi);
    search = qi < 0 ? '' : r.redirect.slice(qi);
  }
  return '/';
}

/**
 * Legacy hash link -> new path URL, or null when `hash` is not a legacy link (e.g. a plain #anchor).
 * v5: #v=search&q=x&d=…&c=…   #15 hash router: #/search?q=x, #/fav, #/trend, #/?d=…
 */
export function legacyHashToPath(hash: string): string | null {
  const h = hash.replace(/^#/, '');
  if (!h) return null;
  if (h.startsWith('/')) {
    const qi = h.indexOf('?');
    return resolve(qi < 0 ? h : h.slice(0, qi), qi < 0 ? '' : h.slice(qi));
  }
  const sp = new URLSearchParams(h);
  if (!['v', 'd', 'c', 'q'].some((k) => sp.has(k))) return null;
  const v = sp.get('v') || 'day';
  const view = V5_VIEWS.includes(v) ? v : 'day';
  const cat = sp.get('c') || null;
  if (view === 'search') return buildPath({ page: 'search', q: sp.get('q') || '', cat });
  if (view === 'fav') return buildPath({ page: 'me' });
  if (view === 'trend') return buildPath({ page: 'archive', tab: 'trend' });
  return buildPath({ page: 'day', date: sp.get('d') || null, cat });
}
