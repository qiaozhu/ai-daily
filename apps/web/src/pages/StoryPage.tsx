// F2 话题详情页 /story/<id> (PRD v6 F2, hifi-v1 §2). Lazy-loaded chunk (first-load budget, #16).
// Data: /api/stories/:id (+ badge, streak_days), /trend (real daily heat, 30 days), /related (<= 5).
// An unknown id is a 404 page (the Worker already answered HTTP 404 without og tags).
import type { RelatedStory, StoryDetail, StoryRelatedResponse, StoryTrendResponse } from '@ai-daily/shared';
import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client.ts';
import { StatusBadge, Tag } from '../components/Badge.tsx';
import { Icon, type IconName } from '../components/Icon.tsx';
import { Aside, Footnote, Main, Toast } from '../components/Layout.tsx';
import { NotFound } from '../components/NotFound.tsx';
import { ErrorState } from '../components/States.tsx';
import { TrendCard } from '../components/TrendCard.tsx';
import { Tweet } from '../components/Tweet.tsx';
import { dateShort } from '../lib/format.ts';
import { saveImageUrl } from '../lib/trend.ts';
import { canGoBack, navigate, onLinkClick } from '../lib/router.ts';
import { storyPath } from '../state/route.ts';
import { useAsync } from '../state/useAsync.ts';
import { useUi } from '../state/ui-context.ts';
import { useShare } from '../state/useShare.ts';

interface Data {
  story: StoryDetail;
  trend: StoryTrendResponse;
  related: StoryRelatedResponse;
}

async function load(id: string): Promise<Data> {
  const story = await api.story(id); // 404 first: no need for the other two
  const [trend, related] = await Promise.all([
    api.storyTrend(id).catch(() => ({ points: [] })),
    api.storyRelated(id).catch(() => ({ stories: [] })),
  ]);
  return { story, trend, related };
}

function RoundButton(props: {
  icon: IconName;
  label: string;
  pressed?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={props.label}
      title={props.label}
      aria-pressed={props.pressed}
      disabled={props.disabled}
      onClick={props.onClick}
      className="flex size-[34px] items-center justify-center rounded-full bg-surface-2 text-brand-text active:scale-[.97] disabled:opacity-50"
    >
      <Icon name={props.icon} size={17} filled={props.pressed} />
    </button>
  );
}

function Card({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-card bg-surface p-4 shadow-card ${className}`}>
      <h2 className="mb-1 text-footnote font-semibold text-text-2">{title}</h2>
      {children}
    </section>
  );
}

function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mt-6 mb-2.5 flex items-baseline justify-between">
      <h2 className="text-headline font-bold">{children}</h2>
      {aside && <span className="text-footnote text-text-2">{aside}</span>}
    </div>
  );
}

function newsLabel(u: string): string {
  try {
    const x = new URL(u);
    return x.host.replace(/^www\./, '') + x.pathname;
  } catch {
    return u;
  }
}

function RelatedChips({ stories }: { stories: readonly RelatedStory[] }) {
  return (
    <ul className="flex flex-wrap gap-2" id="related">
      {stories.map((r) => (
        <li key={r.id} className="max-w-full">
          <a
            href={storyPath(r.id)}
            onClick={onLinkClick}
            data-id={r.id}
            title={`${dateShort(r.date)} · ${r.headline_zh}`}
            className="flex max-w-full items-center gap-0.5 rounded-control bg-surface py-1.5 pr-2 pl-3 text-subhead shadow-card active:scale-[.97]"
          >
            <span className="truncate">{r.headline_zh}</span>
            <span className="shrink-0 text-footnote text-text-2">· {dateShort(r.date)}</span>
            <Icon name="chev" size={13} className="shrink-0 text-text-2" />
          </a>
        </li>
      ))}
    </ul>
  );
}

function ShareActions({ id, onCopy, layout }: { id: string; onCopy: () => void; layout: 'row' | 'column' }) {
  const save = (
    <a
      href={saveImageUrl(id)}
      download={`${id}.png`}
      data-action="save-image"
      className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-button bg-brand text-headline text-on-brand active:scale-[.97]"
    >
      <Icon name="download" size={18} />
      保存分享图
    </a>
  );
  const copy = (
    <button
      type="button"
      onClick={onCopy}
      data-action="copy-link"
      className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-button bg-brand-soft text-headline text-brand-text active:scale-[.97]"
    >
      <Icon name="link" size={18} />
      复制链接
    </button>
  );
  return layout === 'row' ? (
    <div className="mt-6 flex gap-3 xl:hidden" id="storyActions">
      {copy}
      {save}
    </div>
  ) : (
    <div className="grid gap-2.5">
      {save}
      {copy}
    </div>
  );
}

function Skeleton() {
  const bone = (c: string) => <div className={`rounded-md bg-surface-2 ${c}`} />;
  return (
    <div data-state="loading" aria-busy="true" aria-label="加载中" className="grid gap-3">
      {bone('h-5 w-24')}
      {bone('h-8 w-full')}
      {bone('h-8 w-2/3')}
      {bone('mb-2 h-4 w-40')}
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-card bg-surface p-4 shadow-card">
          {bone('mb-2 h-4 w-16')}
          {bone('mb-1.5 h-4 w-full')}
          {bone('h-4 w-3/4')}
        </div>
      ))}
    </div>
  );
}

export default function StoryPage({ id }: { id: string }) {
  const [reload, setReload] = useState(0);
  const res = useAsync('story:' + id, () => load(id), reload);
  const { favs, pending, toggleFav } = useUi();
  const [shareToast, share] = useShare();
  const [toast, setToast] = useState<string | null>(null);
  const data = res.status === 'ready' ? res.data : null;
  const s = data?.story;

  useEffect(() => {
    if (s) document.title = `${s.headline_zh} · AI 热点日报`;
  }, [s]);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 1800);
  };
  const copyLink = () => {
    const url = location.origin + storyPath(id);
    if (!navigator.clipboard) return flash('复制失败');
    navigator.clipboard.writeText(url).then(
      () => flash('链接已复制'),
      () => flash('复制失败'),
    );
  };
  const back = () => (canGoBack() ? history.back() : navigate('/', { top: true }));

  if (res.status === 'error' && res.error instanceof ApiError && res.error.status === 404) {
    return (
      <Main>
        <NotFound kind="story" />
      </Main>
    );
  }

  const fav = favs.has(id);
  const posts = s?.source_posts ?? [];
  const news = s?.news_refs ?? [];

  return (
    <>
      <Main>
        <div className="mb-3 flex items-center justify-between" id="storyNav">
          <a
            href="/"
            onClick={(e) => {
              if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
              e.preventDefault();
              back();
            }}
            className="-ml-1 inline-flex items-center gap-0.5 text-body text-brand-text"
          >
            <Icon name="back" size={18} />
            今日热点
          </a>
          <div className="flex gap-2.5">
            <RoundButton
              icon="bookmark"
              label={fav ? '取消收藏' : '收藏'}
              pressed={fav}
              disabled={pending.has(id) || !s}
              onClick={() => toggleFav(id)}
            />
            <RoundButton icon="share" label="分享" onClick={share} />
          </div>
        </div>

        {res.status === 'loading' && <Skeleton />}
        {res.status === 'error' && <ErrorState onRetry={() => setReload((n) => n + 1)} />}
        {s && data && (
          <article data-story={s.id}>
            <div className="mb-2 flex flex-wrap gap-1.5">
              <StatusBadge story={s} />
              {(s.categories || []).map((c) => (
                <Tag key={c}>{c}</Tag>
              ))}
            </div>
            <h1 id="storyTitle" className="text-title1 lg:text-title1-d">
              {s.headline_zh}
            </h1>
            <p className="mt-1.5 mb-4 text-footnote text-text-2" id="storyMeta">
              {s.org_tag ? `${s.org_tag} · ` : ''}
              {posts.length} 条原帖 · {dateShort(s.date)}
            </p>

            <div className="grid gap-3">
              {s.summary_zh && (
                <Card title="摘要">
                  <p className="text-body">{s.summary_zh}</p>
                </Card>
              )}
              {s.why_it_matters && (
                <Card title="为什么重要">
                  <p className="text-body">{s.why_it_matters}</p>
                </Card>
              )}
              <TrendCard points={data.trend.points} heat={s.heat} />
            </div>

            {posts.length > 0 && (
              <>
                <SectionTitle aside={`${posts.length} 条`}>原帖</SectionTitle>
                <div className="overflow-hidden rounded-card bg-surface shadow-card" id="posts">
                  {posts.map((p) => (
                    <Tweet key={p.post_id + p.url} post={p} />
                  ))}
                </div>
              </>
            )}

            {news.length > 0 && (
              <>
                <SectionTitle>相关新闻</SectionTitle>
                <ul className="overflow-hidden rounded-card bg-surface shadow-card" id="news">
                  {news.map((u, i) => (
                    <li key={u} className="border-t-[0.5px] border-separator first:border-t-0">
                      <a
                        href={u}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 px-4 py-3"
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-surface-2 text-text-on-fill">
                          <Icon name="link" size={16} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-subhead">X 新闻 {i + 1}</span>
                          <span className="block truncate text-caption font-normal text-text-2">{newsLabel(u)}</span>
                        </span>
                        <Icon name="chev" size={15} className="shrink-0 text-text-2" />
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {s.data_quality && (
              <div
                className="mt-4 flex gap-2 rounded-[14px] bg-surface-2 px-3.5 py-3 text-footnote text-text-on-fill"
                id="dataNote"
              >
                <span className="font-semibold whitespace-nowrap">数据说明</span>
                <span>{s.data_quality}</span>
              </div>
            )}

            {data.related.stories.length > 0 && (
              <>
                <SectionTitle>关联话题</SectionTitle>
                <RelatedChips stories={data.related.stories} />
              </>
            )}

            <ShareActions id={s.id} onCopy={copyLink} layout="row" />
          </article>
        )}
        <Footnote />
      </Main>
      <Aside top="pt-10">
        {s && (
          <section className="rounded-card bg-surface p-4 shadow-card" id="shareBox">
            <h2 className="mb-3 text-footnote font-semibold text-text-2">分享这条</h2>
            <ShareActions id={s.id} onCopy={copyLink} layout="column" />
          </section>
        )}
      </Aside>
      <Toast text={toast ?? shareToast} />
    </>
  );
}
