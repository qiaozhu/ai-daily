import type { Story } from '@ai-daily/shared';
import type { KeyboardEvent, MouseEvent } from 'react';
import { Highlight } from './Highlight.tsx';
import { Categories, NewsLinks, StarButton } from './StoryParts.tsx';
import { Tweet } from './Tweet.tsx';

interface Props {
  story: Story;
  showDate: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
}

export function StoryCard({ story: s, showDate, selected, onSelect }: Props) {
  const onClick = (e: MouseEvent) => {
    // post cards / links / buttons keep their own behaviour
    if ((e.target as Element).closest('a, button')) return;
    onSelect(s.id);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && e.target === e.currentTarget) onSelect(s.id);
  };
  return (
    <article
      className={`story ${selected ? 'sel' : ''}`}
      data-id={s.id}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      <div className="sh">
        <span className="rk">#{s.rank}</span>
        <h2>
          <Highlight text={s.headline_zh} />
        </h2>
        <StarButton id={s.id} />
      </div>
      <div className="meta">
        {showDate && <span className="dlabel">📅 {s.date}</span>}
        {s.org_tag && <span className="org">{s.org_tag}</span>}
        <Categories story={s} />
        <span className="heat" title="热度分（0-100）">
          🔥 {s.heat ?? '-'}
        </span>
      </div>
      {(s.source_posts || []).map((p) => (
        <Tweet key={p.post_id + p.url} post={p} />
      ))}
      <div className="inline-sum">
        <div className="sumh">
          AI 摘要 <span className="badge">Grok Bot</span>
        </div>
        <Highlight text={s.summary_zh} />
        {s.why_it_matters && (
          <div style={{ marginTop: 6 }}>
            <b>为什么重要：</b>
            <Highlight text={s.why_it_matters} />
          </div>
        )}
        {s.data_quality && (
          <div className="dq" style={{ marginTop: 8 }}>
            ⚠️ {s.data_quality}
          </div>
        )}
        {(s.news_refs || []).length > 0 && (
          <div className="links" style={{ marginTop: 6 }}>
            <NewsLinks story={s} />
          </div>
        )}
      </div>
    </article>
  );
}
