import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.ts';
import { Icon } from '../components/Icon.tsx';
import { Footnote, Main } from '../components/Layout.tsx';
import { EmptyState, ErrorState, ListSkeleton } from '../components/States.tsx';
import { CategoryFilter, StoryList } from '../components/StoryList.tsx';
import { navigate } from '../lib/router.ts';
import { buildPath, Q_MAX } from '../state/route.ts';
import { useAsync } from '../state/useAsync.ts';

const DEBOUNCE_MS = 250;

/** 搜索: v5 search across all days (titles, summaries, tags, X posts incl. translations); visual refresh only */
export default function SearchPage({ q, cat, dayCount }: { q: string; cat: string | null; dayCount: number }) {
  const [input, setInput] = useState(q);
  const [prevQ, setPrevQ] = useState(q);
  if (prevQ !== q) {
    // URL changed elsewhere (back/forward, a topic link): mirror it into the box
    setPrevQ(q);
    if (q !== input.trim()) setInput(q);
  }
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  const [reload, setReload] = useState(0);
  const res = useAsync(q ? 'search:' + q : null, () => api.search(q), reload);

  const onInput = (v: string) => {
    setInput(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(
      () => navigate(buildPath({ page: 'search', q: v.trim().slice(0, Q_MAX), cat: null }), { replace: true }),
      DEBOUNCE_MS,
    );
  };

  let body: React.ReactNode;
  if (!q) {
    body = (
      <p className="vh text-subhead text-text-2">
        搜索全部 {dayCount} 天日报的标题、摘要、标签和 X 原帖（含译文）。多个关键词用空格分隔。
      </p>
    );
  } else if (res.status === 'loading') body = <ListSkeleton n={2} />;
  else if (res.status === 'error') body = <ErrorState onRetry={() => setReload((n) => n + 1)} />;
  else {
    const r = res.data;
    body = (
      <>
        <p className="vh mb-4 text-footnote text-text-2">
          “{q}” · 在全部 {dayCount} 天中找到 {r.count} 条
        </p>
        {r.stories.length > 0 && (
          <div className="mb-4">
            <CategoryFilter
              pool={r.stories}
              cat={cat}
              onCat={(c) => navigate(buildPath({ page: 'search', q, cat: c }), { replace: true })}
            />
          </div>
        )}
        {r.stories.length ? (
          <StoryList stories={r.stories} cat={cat} title="搜索结果" showDate empty="该分类下暂无内容" />
        ) : (
          <EmptyState>没有匹配的内容</EmptyState>
        )}
      </>
    );
  }

  return (
    <Main>
      <h1 id="title" className="mb-3 text-large lg:text-large-d">
        搜索
      </h1>
      <label
        id="searchbar"
        className="mb-4 flex h-10 items-center gap-2 rounded-control bg-surface-2 px-3 text-text-on-fill"
      >
        <Icon name="search" size={18} />
        <input
          ref={inputRef}
          id="q"
          type="search"
          value={input}
          onChange={(e) => onInput(e.target.value)}
          placeholder="搜索全部日期的标题、摘要、原帖…"
          aria-label="搜索"
          enterKeyHint="search"
          maxLength={Q_MAX}
          className="min-w-0 flex-1 bg-transparent text-body text-text outline-none placeholder:text-text-on-fill"
        />
      </label>
      {body}
      <Footnote />
    </Main>
  );
}
