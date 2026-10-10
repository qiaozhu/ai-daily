import type { Story } from '@ai-daily/shared';
import type { View } from '../state/route.ts';
import { Highlight } from './Highlight.tsx';
import { Categories, NewsLinks, StarButton } from './StoryParts.tsx';

/** right column: AI summary of the selected story (desktop only; mobile shows inline summaries) */
export function SummaryPanel({ story: s, view }: { story: Story | undefined; view: View }) {
  if (!s) {
    return (
      <div className="panel" id="panel">
        <div className="ph">
          AI 摘要 <span className="badge">Grok Bot</span>
        </div>
        <div className="pb">
          <p style={{ color: 'var(--sub)' }}>
            {view === 'trend'
              ? '趋势页汇总全部历史日报。切回“今日”查看单条资讯的 AI 摘要。'
              : '点击任意话题，在这里查看 AI 摘要。'}
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="panel" id="panel">
      <div className="ph">
        AI 摘要 <span className="badge">Grok Bot</span>
        <StarButton id={s.id} />
      </div>
      <div className="pb">
        <div className="meta">
          {s.org_tag && <span className="org">{s.org_tag}</span>}
          <Categories story={s} />
          <span className="heat">🔥 {s.heat ?? '-'}</span>
        </div>
        <h3>
          <Highlight text={s.headline_zh} />
        </h3>
        <p>
          <Highlight text={s.summary_zh} />
        </p>
        {s.why_it_matters && (
          <p className="why">
            <b>为什么重要：</b>
            <Highlight text={s.why_it_matters} />
          </p>
        )}
        {s.data_quality && <p className="dq">⚠️ {s.data_quality}</p>}
        <div className="src">
          📅 {s.date} · 基于 {(s.source_posts || []).length} 条 X 原帖
        </div>
        {(s.news_refs || []).length > 0 && (
          <div className="links">
            <NewsLinks story={s} />
          </div>
        )}
      </div>
    </div>
  );
}
