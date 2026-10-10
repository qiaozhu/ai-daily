import type { Story } from '@ai-daily/shared';
import { dateShort } from '../lib/format.ts';
import { onLinkClick } from '../lib/router.ts';
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
 * Topic card (spec §7, hifi-v1 §1): badge + "机构 · N 条原帖", headline (2 lines), summary (2 lines),
 * heat bar + "详情 ›". The whole card is one link to the detail page /story/<id> (F2): a real <a href>, so
 * keyboard, middle-click / new tab and screen readers work; plain clicks navigate in-app.
 */
export function StoryCard({ story: s, showDate }: Props) {
  const posts = s.source_posts || [];
  return (
    <article className="story rounded-card bg-surface shadow-card" data-id={s.id}>
      <a
        href={storyPath(s.id)}
        onClick={onLinkClick}
        className="block rounded-card p-4 transition-transform duration-200 ease-standard active:scale-[.97] motion-reduce:active:scale-100"
      >
        <div className="mb-2 flex min-w-0 items-center gap-2 text-footnote text-text-2">
          <StatusBadge story={s} />
          <span className="truncate">
            {showDate && <span className="dlabel">{dateShort(s.date)} · </span>}
            {s.org_tag ? `${s.org_tag} · ` : ''}
            {posts.length} 条原帖
          </span>
        </div>
        <h3 className="mb-1.5 line-clamp-2 text-headline">
          <Highlight text={s.headline_zh} />
        </h3>
        {s.summary_zh && (
          <p className="line-clamp-2 text-subhead text-text-2">
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
          <span className="more inline-flex items-center text-brand-text" aria-hidden="true">
            详情
            <Icon name="chev" size={14} />
          </span>
        </div>
      </a>
    </article>
  );
}
