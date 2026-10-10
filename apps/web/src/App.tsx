import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { api } from './api/client.ts';
import { Main } from './components/Layout.tsx';
import { SideNav, TabBar } from './components/Nav.tsx';
import { ListSkeleton } from './components/States.tsx';
import { queryTerms } from './lib/highlight.ts';
import { navigate, useUrl } from './lib/router.ts';
import { applyTheme, initialTheme, type Theme } from './lib/theme.ts';
import { HomePage, type Boot } from './pages/HomePage.tsx';
import { parseRoute, type TabPage } from './state/route.ts';
import { NotFoundContext, UiContext, type UiContextValue } from './state/ui-context.ts';

// the home page ships in the entry chunk; the other tabs are loaded on demand (#16 first-load budget)
const SearchPage = lazy(() => import('./pages/SearchPage.tsx'));
const ArchivePage = lazy(() => import('./pages/ArchivePage.tsx'));
const MePage = lazy(() => import('./pages/MePage.tsx'));
const StoryPage = lazy(() => import('./pages/StoryPage.tsx'));

const TITLE: Record<string, string> = {
  day: 'AI 热点日报',
  search: '搜索',
  archive: '往期',
  me: '我的',
  story: '话题',
};

export function App() {
  const url = useUrl();
  const qi = url.indexOf('?');
  const parsed = parseRoute(qi < 0 ? url : url.slice(0, qi), qi < 0 ? '' : url.slice(qi));
  const redirect = 'redirect' in parsed ? parsed.redirect : null;
  useLayoutEffect(() => {
    if (redirect) navigate(redirect, { replace: true });
  }, [redirect]);

  // ---- boot: day list + favorite ids ----
  const [boot, setBoot] = useState<Boot>({ status: 'loading' });
  const [bootTry, setBootTry] = useState(0);
  const [favs, setFavs] = useState<ReadonlySet<string>>(new Set());
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    let alive = true;
    Promise.all([api.days(), api.favorites()]).then(
      ([d, f]) => {
        if (!alive) return;
        setFavs(new Set(f.ids));
        setBoot({ status: 'ready', days: d.days });
      },
      () => alive && setBoot({ status: 'error' }),
    );
    return () => {
      alive = false;
    };
  }, [bootTry]);
  const days = boot.status === 'ready' ? boot.days : [];
  const latest = days[0]?.date ?? null;

  // ---- theme (default light, never follows the system; a manual choice is remembered) ----
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const toggleTheme = () => {
    const n: Theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(n, true);
    setTheme(n);
  };

  // ---- favorites ----
  const [favVersion, setFavVersion] = useState(0);
  const toggleFav = useCallback(
    async (id: string) => {
      const on = favs.has(id);
      setPending((p) => new Set(p).add(id));
      try {
        if (on) await api.removeFavorite(id);
        else await api.addFavorite(id);
        setFavs((f) => {
          const n = new Set(f);
          if (on) n.delete(id);
          else n.add(id);
          return n;
        });
        setFavVersion((v) => v + 1);
      } catch (e) {
        alert('收藏失败：' + (e instanceof Error ? e.message : String(e)));
      } finally {
        setPending((p) => {
          const n = new Set(p);
          n.delete(id);
          return n;
        });
      }
    },
    [favs],
  );
  const onFavsLoaded = useCallback((ids: string[]) => setFavs(new Set(ids)), []);

  // a NotFound page on screen -> no tab highlighted (PR #20); the story page belongs to 今日
  const [notFound, setNotFound] = useState(false);
  const route = 'route' in parsed ? parsed.route : null;
  const q = route?.page === 'search' ? route.q : '';
  const ui: UiContextValue = useMemo(
    () => ({ favs, pending, toggleFav: (id) => void toggleFav(id), terms: queryTerms(q) }),
    [favs, pending, toggleFav, q],
  );

  useEffect(() => {
    if (route && route.page !== 'story')
      document.title = route.page === 'day' ? 'AI 热点日报' : `${TITLE[route.page]} · AI 热点日报`;
  }, [route?.page]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!route) return null;

  let page: React.ReactNode;
  switch (route.page) {
    case 'day':
      page = (
        <HomePage
          date={route.date}
          cat={route.cat}
          boot={boot}
          latest={latest}
          onRetryBoot={() => {
            setBoot({ status: 'loading' });
            setBootTry((n) => n + 1);
          }}
        />
      );
      break;
    case 'search':
      page = <SearchPage q={route.q} cat={route.cat} dayCount={days.length} />;
      break;
    case 'archive':
      page = <ArchivePage tab={route.tab} days={days} latest={latest} />;
      break;
    case 'story':
      page = <StoryPage key={route.id} id={route.id} />;
      break;
    case 'me':
      page = <MePage favVersion={favVersion} onFavsLoaded={onFavsLoaded} theme={theme} onToggleTheme={toggleTheme} />;
      break;
  }

  const tab: TabPage | null = notFound ? null : route.page === 'story' ? 'day' : route.page;

  return (
    <UiContext.Provider value={ui}>
      <NotFoundContext.Provider value={setNotFound}>
        <div
          className="lg:grid lg:grid-cols-[240px_minmax(0,680px)] lg:justify-center lg:gap-8 lg:px-6 xl:grid-cols-[240px_680px_320px]"
          data-page={route.page}
        >
          <SideNav active={tab} favCount={favs.size} />
          <Suspense
            fallback={
              <Main>
                <ListSkeleton n={3} />
              </Main>
            }
          >
            {page}
          </Suspense>
        </div>
        <TabBar active={tab} />
      </NotFoundContext.Provider>
    </UiContext.Provider>
  );
}
