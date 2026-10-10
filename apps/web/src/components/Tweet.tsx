import type { SourcePost } from '@ai-daily/shared';
import { avatarColor, formatCount, postTime } from '../lib/format.ts';
import { displayName } from '../lib/names.ts';
import { Highlight } from './Highlight.tsx';
import { Icon, type IconName } from './icons.tsx';

function Metric({ k, value, label }: { k: IconName; value: number | null; label: string }) {
  if (value == null) return null;
  return (
    <span className={`m m-${k}`} title={`${label} ${value}`}>
      <Icon name={k} />
      <b>{formatCount(value)}</b>
    </span>
  );
}

/** X post card linking to the original post (opens in a new tab) */
export function Tweet({ post }: { post: SourcePost }) {
  const t = postTime(post.post_id);
  const tr = post.translation_zh || '';
  const showOrig = !!(post.text && tr && post.text !== tr);
  const name = displayName(post);
  return (
    <a className="tw" href={post.url} target="_blank" rel="noopener noreferrer" title="在 X 上打开原帖">
      <div className="tw-l">
        <div className="av" style={{ background: avatarColor(post.handle) }} aria-hidden="true">
          {name.trim().charAt(0).toUpperCase()}
        </div>
      </div>
      <div className="tw-r">
        <div className="tw-h">
          <span className="tw-name">{name}</span>
          <span className="tw-handle">@{post.handle}</span>
          {t.short && (
            <>
              <span className="dot">·</span>
              <time dateTime={new Date(t.ms).toISOString()} title={t.full}>
                {t.short}
              </time>
            </>
          )}
          <span className="tw-x">
            <Icon name="x" />
          </span>
        </div>
        {showOrig && (
          <div className="tw-text">
            <Highlight text={post.text} />
          </div>
        )}
        <div className="tw-tr">
          {showOrig && <span className="trl">译</span>}
          <Highlight text={tr || post.text} />
        </div>
        <div className="tw-m">
          <Metric k="reply" value={post.replies} label="回复" />
          <Metric k="rt" value={post.reposts} label="转发" />
          <Metric k="like" value={post.likes} label="点赞" />
          <Metric k="view" value={post.views} label="浏览" />
        </div>
      </div>
    </a>
  );
}
