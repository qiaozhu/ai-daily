import type { Story } from '@ai-daily/shared';
import { dateShort } from '../lib/format.ts';
import { navigate, onLinkClick } from '../lib/router.ts';
import { heatPct } from '../lib/stories.ts';
import { storyPath } from '../state/route.ts';
import { StatusBadge } from './Badge.tsx';
import { Highlight } from './Highlight.tsx';
import { Icon } from './Icon.tsx';

type CardStory = Story & { badge?: 'new' | 'ongoing' | null; streak_days?: number | null };

interface Props {
  story: CardStory;
  /** show the story's date (search results, favorites) */
  showDate?: boolean;
}

/**
 * Topic card, single column (Issue #28 design note): badge row, headline (2 lines max), the FULL summary
 * (never clamped), then "来源 · N 条原帖 · 热度" + "详情 ›". The headline and "详情" are real links (keyboard,
 * new tab); a click anywhere else on the card opens the detail page too, unless the user is selecting text
 * (the summary can be selected and copied).
 */
export function StoryCard({ story: s, showDate }: Props) {
  const posts = s.source_posts || [];
  const href = storyPath(s.id);
  const top = s.badge || showDate;
  return (
    <article
      className="story cursor-pointer rounded-card bg-surface p-4 shadow-card lg:px-6 lg:py-5"
      data-id={s.id}
      onClick={(e) => {
        if ((e.target as Element).closest('a')) return; // links handle themselves
        if (window.getSelection()?.toString()) return; // selecting the summary: do not navigate
        navigate(href, { top: true });
      }}
    >
      {top && (
        <div className="mb-2 flex min-w-0 items-center gap-2 text-footnote text-text-2">
          <StatusBadge story={s} />
          {showDate && <span className="dlabel">{dateShort(s.date)}</span>}
        </div>
      )}
      <h3 className="line-clamp-2 text-[17px] leading-[1.4] font-semibold lg:text-[18px]">
        <a href={href} onClick={onLinkClick} className="story-link">
          <Highlight text={s.headline_zh} />
        </a>
      </h3>
      {s.summary_zh && (
        <p className="summary mt-2 text-[15px] leading-[1.65] whitespace-pre-line text-text">
          <Highlight text={s.summary_zh} />
        </p>
      )}
      <div className="mt-3 flex items-center justify-between gap-3 text-footnote text-text-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate">
            {s.org_tag ? `${s.org_tag} · ` : ''}
            {posts.length} 条原帖 ·
          </span>
          <span className="heat flex shrink-0 items-center gap-1.5" title="热度分（0–100）">
            <span className="h-1 w-11 overflow-hidden rounded-xs bg-surface-2">
              <i className="block h-full bg-brand" style={{ width: `${heatPct(s.heat)}%` }} />
            </span>
            热度 {s.heat ?? '–'}
          </span>
        </span>
        <a
          href={href}
          onClick={onLinkClick}
          tabIndex={-1}
          className="more inline-flex shrink-0 items-center text-brand-text"
          data-detail=""
        >
          详情
          <Icon name="chev" size={14} />
        </a>
      </div>
    </article>
  );
}
