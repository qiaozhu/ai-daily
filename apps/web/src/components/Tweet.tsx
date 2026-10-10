import type { SourcePost } from '@ai-daily/shared';
import { formatCount, postTime } from '../lib/format.ts';
import { displayName } from '../lib/names.ts';
import { Highlight } from './Highlight.tsx';
import { Icon, type IconName } from './Icon.tsx';

function Metric({ icon, value, label }: { icon: IconName; value: number | null; label: string }) {
  if (value == null) return null;
  return (
    <span className="inline-flex items-center gap-1" title={`${label} ${value}`}>
      <Icon name={icon} size={14} />
      {formatCount(value)}
    </span>
  );
}

/** one X post (hifi-v1 §2.6 list row): avatar initial, name/@handle/time, original + 中文译文, counts, ↗ */
export function Tweet({ post }: { post: SourcePost }) {
  const t = postTime(post.post_id);
  const tr = post.translation_zh || '';
  const showOrig = !!(post.text && tr && post.text !== tr);
  const name = displayName(post);
  return (
    <a
      className="tw flex gap-3 border-t-[0.5px] border-separator px-4 py-3.5 first:border-t-0 hover:bg-surface-2/50"
      href={post.url}
      target="_blank"
      rel="noopener noreferrer"
      title="在 X 上打开原帖"
    >
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-subhead font-bold text-text-fill"
        aria-hidden="true"
      >
        {name.trim().charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-1 text-subhead">
          <span className="tw-name font-semibold">{name}</span>
          <span className="text-text-2">@{post.handle}</span>
          {t.short && (
            <>
              <span className="text-text-2">·</span>
              <time className="text-footnote text-text-2" dateTime={new Date(t.ms).toISOString()} title={t.full}>
                {t.short}
              </time>
            </>
          )}
        </div>
        {showOrig && (
          <p className="mt-1 text-subhead break-words text-text-2">
            <Highlight text={post.text} />
          </p>
        )}
        <p className="mt-1 text-body break-words">
          {showOrig && (
            <span className="mr-1 rounded bg-brand-soft px-1 text-caption text-brand-text" aria-label="译文">
              译
            </span>
          )}
          <Highlight text={tr || post.text} />
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3.5 text-caption font-normal text-text-2">
          <Metric icon="heart" value={post.likes} label="赞" />
          <Metric icon="repost" value={post.reposts} label="转发" />
          <Metric icon="reply" value={post.replies} label="回复" />
          <Metric icon="chart" value={post.views} label="浏览" />
          <span className="ml-auto inline-flex items-center gap-0.5 text-brand-text">
            原帖 <Icon name="ext" size={13} />
          </span>
        </div>
      </div>
    </a>
  );
}
