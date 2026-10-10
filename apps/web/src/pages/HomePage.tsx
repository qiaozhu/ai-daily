import type { DayDetail, DaySummary } from '@ai-daily/shared';
import { api, ApiError } from '../api/client.ts';
import { Icon } from '../components/Icon.tsx';
import { NotFound } from '../components/NotFound.tsx';
import { Aside, Footnote, IconButton, Main, Toast } from '../components/Layout.tsx';
import { useShare } from '../state/useShare.ts';
import { useExpanded } from '../state/useExpanded.ts';
import { HeroSkeleton, EmptyState, ErrorState, ListSkeleton } from '../components/States.tsx';
import { CategoryFilter, StoryList } from '../components/StoryList.tsx';
import { dateShort, generatedClock, weekdayCN } from '../lib/format.ts';
import { navigate, onLinkClick } from '../lib/router.ts';
import { topByHeat } from '../lib/stories.ts';
import { buildPath } from '../state/route.ts';
import { useAsync } from '../state/useAsync.ts';

export type Boot = { status: 'loading' } | { status: 'error' } | { status: 'ready'; days: DaySummary[] };

interface Props {
  /** explicit /day/<date>, null = latest */
  date: string | null;
  cat: string | null;
  boot: Boot;
  latest: string | null;
  onRetryBoot: () => void;
}

/** 今日三件事: highlights[0..3), hidden when empty */
function Highlights({ items, isLatest }: { items: string[]; isLatest: boolean }) {
  const top = items.slice(0, 3);
  if (!top.length) return null;
  return (
    <section id="three" className="rounded-hero bg-surface p-[18px] shadow-card" aria-label="今日三件事">
      <div className="mb-1.5 flex items-center justify-between text-footnote font-semibold text-brand-text">
        <span className="flex items-center gap-1.5">
          <i className="size-1.5 rounded-full bg-brand" />
          {isLatest ? '今日三件事' : '当日三件事'}
        </span>
        <em className="font-normal text-text-2 not-italic">来自今日要点</em>
      </div>
      <ol>
        {top.map((h, i) => (
          <li key={i} className="it flex gap-3 border-t-[0.5px] border-separator py-[11px] text-body first:border-t-0">
            <b className="w-3 flex-none font-semibold text-text-2">{i + 1}</b>
            <span>{h}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function HeatRank({ day, onPick }: { day: DayDetail; onPick: (id: string) => void }) {
  return (
    <section className="rounded-card bg-surface p-4 shadow-card" id="heatrank">
      <h2 className="mb-1.5 text-headline font-bold">热度榜</h2>
      <ol>
        {topByHeat(day.stories, 8).map((s, i) => (
          <li key={s.id} data-id={s.id} className="border-t-[0.5px] border-separator first:border-t-0">
            <button
              type="button"
              className="flex w-full gap-3 py-[11px] text-left text-subhead"
              onClick={() => onPick(s.id)}
            >
              <b className={`w-4 flex-none font-semibold ${i < 3 ? 'text-brand-text' : 'text-text-2'}`}>{i + 1}</b>
              <span className="line-clamp-2 flex-1">{s.headline_zh}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function HomePage({ date: wanted, cat, boot, latest, onRetryBoot }: Props) {
  const days = boot.status === 'ready' ? boot.days : [];
  const date = wanted ?? latest;
  const known = !!date && days.some((d) => d.date === date);
  const res = useAsync(known ? 'day:' + date : null, () => api.day(date as string));
  const expanded = useExpanded();
  const [toast, share] = useShare();

  const idx = days.findIndex((d) => d.date === date);
  const older = idx >= 0 ? days[idx + 1] : undefined;
  const newer = idx > 0 ? days[idx - 1] : undefined;
  const go = (d: string | undefined) =>
    d && navigate(buildPath({ page: 'day', date: d, cat: null }, latest), { top: true });
  const isLatest = !!date && date === latest;
  const day = res.status === 'ready' ? res.data : null;

  const arrow = (dir: 'back' | 'chev', target: DaySummary | undefined, label: string) => (
    <button
      type="button"
      aria-label={label}
      data-nav={dir === 'back' ? 'prev' : 'next'}
      disabled={!target}
      onClick={() => go(target?.date)}
      className="flex size-6 items-center justify-center rounded-full text-text-2 disabled:text-text-3 disabled:opacity-60"
    >
      <Icon name={dir} size={15} />
    </button>
  );

  let content: React.ReactNode;
  if (boot.status === 'loading' || (known && res.status === 'loading')) {
    content = (
      <div className="grid gap-5">
        <HeroSkeleton />
        <ListSkeleton n={3} />
      </div>
    );
  } else if (
    boot.status === 'error' ||
    (res.status === 'error' && !(res.error instanceof ApiError && res.error.status === 404))
  ) {
    content = <ErrorState onRetry={boot.status === 'error' ? onRetryBoot : () => location.reload()} />;
  } else if (!latest) {
    content = <EmptyState>今天的日报还在路上，08:50 左右更新</EmptyState>;
  } else if (!day) {
    // /day/<date> without a report (the Worker already answered with HTTP 404)
    return (
      <Main>
        <NotFound kind="day" earliest={days[days.length - 1]?.date ?? null} />
      </Main>
    );
  } else {
    content = (
      <>
        <Highlights items={day.highlights} isLatest={isLatest} />
        {day.stories.length > 0 && (
          <div className="mt-5 mb-4 lg:mt-6">
            <CategoryFilter
              pool={day.stories}
              cat={cat}
              onCat={(c) => navigate(buildPath({ page: 'day', date, cat: c }, latest), { replace: true })}
            />
          </div>
        )}
        <StoryList
          stories={day.stories}
          cat={cat}
          title={cat ?? '全部话题'}
          twoCols
          empty={day.stories.length ? '该分类下暂无内容' : '这一天没有话题'}
          expanded={expanded}
        />
        {day.data_quality_notes.length > 0 && (
          <div className="notes mt-6 rounded-[14px] bg-surface-2 px-3.5 py-3 text-footnote text-text-on-fill">
            <div className="mb-1 font-semibold">数据说明</div>
            <ul className="list-disc pl-4">
              {day.data_quality_notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <Main>
        <header className="mb-4 lg:mb-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-footnote font-semibold text-text-2">
              {arrow('back', older, '前一天')}
              <a href="/archive" onClick={onLinkClick} id="dateLabel" title="往期日报">
                {date ? `${dateShort(date)} ${weekdayCN(date)}` : '\u00a0'}
              </a>
              {arrow('chev', newer, '后一天')}
            </div>
            <div className="flex gap-2.5">
              <span className="hidden lg:contents">
                <IconButton icon="search" label="搜索" onClick={() => navigate('/search', { top: true })} />
              </span>
              <IconButton icon="share" label="分享" onClick={share} />
            </div>
          </div>
          <h1 id="title" className="mt-1 mb-0.5 text-large lg:text-large-d">
            {isLatest || !date ? '今日热点' : `${dateShort(date)}热点`}
          </h1>
          <p id="sub" className="text-footnote text-text-2">
            {day ? `${day.stories.length} 个话题 · ${generatedClock(day.generated_at)} 更新` : '\u00a0'}
          </p>
        </header>
        {content}
        <Footnote />
      </Main>
      <Aside>
        {day && day.stories.length > 0 && (
          <HeatRank
            day={day}
            onPick={(id) => {
              expanded.show(id);
              requestAnimationFrame(() =>
                document.querySelector(`[data-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'center' }),
              );
            }}
          />
        )}
        <p className="mx-1 mt-3.5 text-caption font-normal text-text-2">数据来自 X 公开内容，每天 08:50 更新。</p>
      </Aside>
      <Toast text={toast} />
    </>
  );
}
