import type { Story } from '@ai-daily/shared';
import { dateShort } from '../lib/format.ts';
import { heatPct } from '../lib/stories.ts';
import { useUi } from '../state/ui-context.ts';
import { StatusBadge, Tag } from './Badge.tsx';
import { Highlight } from './Highlight.tsx';
import { Icon } from './Icon.tsx';
import { Tweet } from './Tweet.tsx';

type CardStory = Story & { badge?: 'new' | 'ongoing' | null; streak_days?: number | null };

interface Props {
  story: CardStory;
  /** show the story's date (search results, favorites) */
  showDate?: boolean;
  expanded: boolean;
  onToggle: (id: string) => void;
}

function FavButton({ id }: { id: string }) {
  const { favs, pending, toggleFav } = useUi();
  const on = favs.has(id);
  return (
    <button
      type="button"
      className="star inline-flex h-11 items-center justify-center gap-1.5 rounded-button bg-brand-soft px-4 text-body font-semibold text-brand-text active:scale-[.97] disabled:opacity-50"
      data-fav={id}
      aria-pressed={on}
      disabled={pending.has(id)}
      onClick={(e) => {
        e.stopPropagation();
        toggleFav(id);
      }}
    >
      <Icon name="bookmark" size={18} filled={on} />
      {on ? '已收藏' : '收藏'}
    </button>
  );
}

/**
 * Topic card (spec §7, hifi-v1 §1): badge + "机构 · N 条原帖", headline (2 lines), summary (2 lines),
 * heat bar + "详情 ›". Until the F2 detail page (#9) ships, "详情" expands the v5 content in place:
 * why it matters, data notes, all X posts, news links and the favorite button.
 */
export function StoryCard({ story: s, showDate, expanded, onToggle }: Props) {
  const posts = s.source_posts || [];
  const toggle = () => onToggle(s.id);
  return (
    <article className="story rounded-card bg-surface shadow-card" data-id={s.id} data-expanded={expanded || undefined}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={toggle}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
            e.preventDefault();
            toggle();
          }
        }}
        className="block cursor-pointer p-4 transition-transform duration-200 ease-standard select-none active:scale-[.97] motion-reduce:active:scale-100"
      >
        <div className="mb-2 flex min-w-0 items-center gap-2 text-footnote text-text-2">
          <StatusBadge story={s} />
          <span className="truncate">
            {showDate && <span className="dlabel">{dateShort(s.date)} · </span>}
            {s.org_tag ? `${s.org_tag} · ` : ''}
            {posts.length} 条原帖
          </span>
        </div>
        <h3 className={`mb-1.5 text-headline ${expanded ? '' : 'line-clamp-2'}`}>
          <Highlight text={s.headline_zh} />
        </h3>
        {s.summary_zh && (
          <p className={`text-subhead text-text-2 ${expanded ? '' : 'line-clamp-2'}`}>
            <Highlight text={s.summary_zh} />
          </p>
        )}
        <div className="mt-3 flex items-center justify-between text-footnote text-text-2">
          <span className="heat flex items-center gap-1.5" title="热度分（0–100）">
            <span className="h-1 w-11 overflow-hidden rounded-xs bg-surface-2">
              <i className="block h-full bg-brand" style={{ width: `${heatPct(s.heat)}%` }} />
            </span>
            热度 {s.heat ?? '–'}
          </span>
          <span className="more inline-flex items-center text-brand-text">
            {expanded ? '收起' : '详情'}
            <Icon name={expanded ? 'down' : 'chev'} size={14} />
          </span>
        </div>
      </div>
      {expanded && (
        <div className="details border-t-[0.5px] border-separator">
          <div className="grid gap-3 p-4 pt-3">
            {(s.categories || []).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {s.categories.map((c) => (
                  <Tag key={c}>{c}</Tag>
                ))}
              </div>
            )}
            {s.why_it_matters && (
              <div>
                <div className="mb-1 text-footnote font-semibold text-text-2">为什么重要</div>
                <p className="text-body">
                  <Highlight text={s.why_it_matters} />
                </p>
              </div>
            )}
            {s.data_quality && (
              <div className="flex gap-2 rounded-[14px] bg-surface-2 px-3.5 py-3 text-footnote text-text-on-fill">
                <span className="font-semibold whitespace-nowrap">数据说明</span>
                <span>{s.data_quality}</span>
              </div>
            )}
          </div>
          {posts.length > 0 && (
            <div className="border-t-[0.5px] border-separator">
              <div className="px-4 pt-3 text-footnote font-semibold text-text-2">原帖 {posts.length} 条</div>
              {posts.map((p) => (
                <Tweet key={p.post_id + p.url} post={p} />
              ))}
            </div>
          )}
          {(s.news_refs || []).length > 0 && (
            <div className="links flex flex-wrap gap-x-4 gap-y-1 border-t-[0.5px] border-separator px-4 py-3 text-footnote">
              {s.news_refs.map((u, i) => (
                <a
                  key={u}
                  href={u}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-brand-text"
                >
                  <Icon name="link" size={14} />X 新闻 {i + 1}
                </a>
              ))}
            </div>
          )}
          <div className="flex border-t-[0.5px] border-separator p-4">
            <FavButton id={s.id} />
          </div>
        </div>
      )}
    </article>
  );
}
