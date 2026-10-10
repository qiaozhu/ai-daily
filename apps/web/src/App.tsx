import type { DaySummary, Story } from '@ai-daily/shared';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { api } from './api/client.ts';
import { CategoryChips } from './components/CategoryChips.tsx';
import { Icon } from './components/icons.tsx';
import { LeftNav } from './components/LeftNav.tsx';
import { MainHeader } from './components/MainHeader.tsx';
import { StoryCard } from './components/StoryCard.tsx';
import { SummaryPanel } from './components/SummaryPanel.tsx';
import { countCategories, filterByCategory } from './lib/categories.ts';
import { dateCN, generatedClock } from './lib/format.ts';
import { queryTerms } from './lib/highlight.ts';
import { applyTheme, initialTheme, type Theme } from './lib/theme.ts';
import { buildRoute, parseRoute, pathToView, VIEW_TITLE, type RouteState, type View } from './state/route.ts';
import { UiContext, type UiContextValue } from './state/ui-context.ts';
import { useViewData, type ViewData } from './state/useViewData.ts';
import { TrendView } from './views/TrendView.tsx';

const FOOTNOTE = '数据来自 X 平台公开内容 · 互动数为抓取时数值 · 时间为北京时间（UTC+8）';
const SEARCH_DEBOUNCE_MS = 250;

type Boot =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; days: DaySummary[]; latest: string | null };

/** stories shown by a view before the category filter */
function poolOf(d: ViewData | undefined): Story[] {
  if (!d) return [];
  if (d.kind === 'day') return d.day.stories;
  if (d.kind === 'search' || d.kind === 'fav') return d.result.stories;
  return [];
}

export function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const knownPath = pathToView(location.pathname) !== null;
  const route = parseRoute(location.pathname, location.search);

  // ---- boot: day list + favorites ----
  const [boot, setBoot] = useState<Boot>({ status: 'loading' });
  const [favs, setFavs] = useState<ReadonlySet<string>>(new Set());
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    Promise.all([api.days(), api.favorites()]).then(
      ([d, f]) => {
        setFavs(new Set(f.ids));
        setBoot({ status: 'ready', days: d.days, latest: d.latest });
      },
      (e: unknown) => setBoot({ status: 'error', message: e instanceof Error ? e.message : String(e) }),
    );
  }, []);
  const days = boot.status === 'ready' ? boot.days : [];
  const latest = boot.status === 'ready' ? boot.latest : null;
  // an unknown ?d= falls back to the newest day
  const date = route.date && days.some((d) => d.date === route.date) ? route.date : latest;
  const { view, cat, q } = route;

  // ---- navigation (URL is the source of truth; replace like v5 did, no history spam) ----
  const go = useCallback(
    (next: Partial<RouteState>, opts: { top?: boolean } = {}) => {
      const s: RouteState = { view, date, cat, q, ...next };
      navigate(buildRoute(s, latest), { replace: true });
      if (opts.top) window.scrollTo(0, 0);
    },
    [navigate, view, date, cat, q, latest],
  );

  // ---- search box (debounced) ----
  const [qInput, setQInput] = useState(q);
  const [prevRouteQ, setPrevRouteQ] = useState(q);
  if (prevRouteQ !== q) {
    // route changed from elsewhere (e.g. a shared link / back to search): mirror it into the box
    setPrevRouteQ(q);
    if (q && q !== qInput.trim()) setQInput(q);
  }
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onSearchInput = (value: string) => {
    setQInput(value);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(
      () => go({ view: 'search', q: value.trim().slice(0, 100), cat: null }),
      SEARCH_DEBOUNCE_MS,
    );
  };
  useEffect(() => () => clearTimeout(debounce.current), []);

  const searchRef = useRef<HTMLInputElement>(null);
  const wantFocus = useRef(false);
  const onView = (v: View) => {
    if (v === view && v !== 'day') {
      if (v === 'search') searchRef.current?.focus();
      return;
    }
    if (v === 'search') wantFocus.current = true;
    go({ view: v, cat: null, q: v === 'search' ? qInput.trim().slice(0, 100) : q }, { top: true });
  };
  const onDate = (d: string) => go({ view: 'day', date: d, cat: null }, { top: true });
  const onTopic = (topic: string) => {
    setQInput(topic);
    go({ view: 'search', q: topic, cat: null }, { top: true });
  };

  // body class drives view-specific CSS (e.g. the search bar); must be applied before focusing the input
  useLayoutEffect(() => {
    document.body.className = 'v-' + view;
  }, [view]);
  useEffect(() => {
    if (view === 'search' && wantFocus.current) {
      wantFocus.current = false;
      searchRef.current?.focus();
    }
  }, [view]);

  // ---- theme ----
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const toggleTheme = () => {
    const n: Theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(n, true);
    setTheme(n);
  };

  // ---- view data ----
  const [reloadKey, setReloadKey] = useState(0);
  // the favorites view is authoritative for the fav set (another device may have changed it)
  const onLoaded = useCallback((d: ViewData) => {
    if (d.kind === 'fav') setFavs(new Set(d.result.ids));
  }, []);
  const vs = useViewData(boot.status === 'ready', view, date, q, reloadKey, onLoaded);
  const data = vs.status === 'ready' ? vs.data : undefined;

  const pool = poolOf(data);
  const list = useMemo(() => filterByCategory(pool, cat), [pool, cat]);
  const [selRaw, setSel] = useState<string | null>(null);
  const sel = list.some((s) => s.id === selRaw) ? selRaw : (list[0]?.id ?? null);

  // ---- favorites ----
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
      } catch (e) {
        alert('收藏失败：' + (e instanceof Error ? e.message : String(e)));
      } finally {
        setPending((p) => {
          const n = new Set(p);
          n.delete(id);
          return n;
        });
      }
      if (view === 'fav') setReloadKey((k) => k + 1);
    },
    [favs, view],
  );

  const ui: UiContextValue = useMemo(
    () => ({ favs, pending, toggleFav: (id) => void toggleFav(id), terms: view === 'search' ? queryTerms(q) : [] }),
    [favs, pending, toggleFav, view, q],
  );

  if (!knownPath) return <Navigate to="/" replace />;

  // ---- middle column content + subtitle ----
  let subtitle: ReactNode = '加载中…';
  let body: ReactNode = <div className="empty">加载中…</div>;
  const storyList = (showDate: boolean, empty: string) =>
    list.length ? (
      list.map((s) => <StoryCard key={s.id} story={s} showDate={showDate} selected={s.id === sel} onSelect={setSel} />)
    ) : (
      <div className="empty">{empty}</div>
    );

  if (boot.status === 'error') {
    subtitle = '加载失败';
    body = <div className="empty err">加载失败：{boot.message}，请稍后刷新重试</div>;
  } else if (vs.status === 'error') {
    body = <div className="empty err">加载失败：{vs.message}，请稍后刷新重试</div>;
  } else if (data) {
    switch (data.kind) {
      case 'no-day':
        body = <div className="empty">暂无日报数据</div>;
        break;
      case 'day': {
        const d = data.day;
        subtitle = (
          <>
            <span className="sd">{dateCN(d.date)} · </span>
            {d.stories.length} 个话题 · 生成于 {generatedClock(d.generated_at)} · 来自 X
          </>
        );
        body = (
          <>
            {storyList(false, '该分类下暂无内容')}
            {(d.data_quality_notes || []).length > 0 && (
              <div className="notes">
                <h3>数据说明</h3>
                <ul>
                  {d.data_quality_notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        );
        break;
      }
      case 'search-empty':
        subtitle = '在全部历史日报中搜索';
        body = (
          <div className="vh">
            <p>
              输入关键词，搜索全部 {days.length} 天日报的标题、摘要、标签和 X 原帖（含译文）。多个关键词用空格分隔。
            </p>
          </div>
        );
        break;
      case 'search':
        subtitle = `“${data.q}” · ${data.result.count} 条结果`;
        body = (
          <>
            <div className="vh">
              <p>
                “{data.q}” · 在全部 {days.length} 天中找到 {data.result.count} 条
              </p>
            </div>
            {storyList(true, '没有匹配的内容')}
          </>
        );
        break;
      case 'fav':
        subtitle = `${data.result.count} 条收藏 · 保存在服务器上`;
        body = (
          <>
            <div className="vh">
              <h2>⭐ 我的收藏</h2>
              <p>共 {data.result.count} 条 · 收藏保存在服务器上，任何设备打开都能看到</p>
            </div>
            {storyList(true, '还没有收藏，点击话题右上角的 ☆ 即可收藏')}
          </>
        );
        break;
      case 'trend':
        subtitle = `${data.result.days.length} 天 · 分类与话题走势`;
        body = <TrendView data={data.result} onDate={onDate} onSearch={onTopic} />;
        break;
    }
  }

  const categories = countCategories(pool);
  const chips = pool.length ? (
    <CategoryChips
      total={pool.length}
      categories={categories}
      active={cat}
      onPick={(c) => go({ cat: c }, { top: true })}
    />
  ) : null;
  const selected = list.find((s) => s.id === sel);

  return (
    <UiContext value={ui}>
      <div className="shell">
        <LeftNav
          view={view}
          date={date}
          days={days}
          favCount={favs.size}
          theme={theme}
          chips={chips}
          exportUrl={api.exportUrl}
          onView={onView}
          onDate={onDate}
          onToggleTheme={toggleTheme}
        />
        <main id="mainCol">
          <MainHeader
            view={view}
            title={VIEW_TITLE[view]}
            subtitle={subtitle}
            date={date}
            days={days}
            theme={theme}
            exportUrl={api.exportUrl}
            onView={onView}
            onDate={onDate}
            onToggleTheme={toggleTheme}
          />
          <div className="searchbar" id="searchbar">
            <label className="sbox">
              <Icon name="search" />
              <input
                ref={searchRef}
                id="q"
                type="search"
                placeholder="搜索全部日期的标题、摘要、原帖…"
                aria-label="搜索"
                enterKeyHint="search"
                value={qInput}
                onChange={(e) => onSearchInput(e.target.value)}
              />
            </label>
          </div>
          <div className="mobilebar" id="mchips" style={chips ? undefined : { display: 'none' }}>
            {chips}
          </div>
          <div id="tl">
            {body}
            <div className="foot">{FOOTNOTE}</div>
          </div>
        </main>
        <aside className="rcol">
          <div className="rsticky">
            <SummaryPanel story={selected} view={view} />
            <div className="rfoot">{FOOTNOTE}</div>
          </div>
        </aside>
      </div>
    </UiContext>
  );
}
