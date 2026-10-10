import type { DaySummary } from '@ai-daily/shared';
import { useState } from 'react';
import { api } from '../api/client.ts';
import { Icon } from '../components/Icon.tsx';
import { Footnote, Main } from '../components/Layout.tsx';
import { Segmented } from '../components/Segmented.tsx';
import { EmptyState, ErrorState, ListSkeleton } from '../components/States.tsx';
import { dateShort, weekdayCN } from '../lib/format.ts';
import { navigate, onLinkClick } from '../lib/router.ts';
import { buildPath, type ArchiveTab } from '../state/route.ts';
import { useAsync } from '../state/useAsync.ts';
import { TrendView } from '../views/TrendView.tsx';

const TABS: { key: ArchiveTab; label: string }[] = [
  { key: 'daily', label: '日报' },
  { key: 'trend', label: '趋势' },
  { key: 'weekly', label: '周报' },
];

function DateList({ days, latest }: { days: DaySummary[]; latest: string | null }) {
  if (!days.length) return <EmptyState>暂无日报数据</EmptyState>;
  return (
    <ul id="dates" className="overflow-hidden rounded-card bg-surface shadow-card">
      {days.map((d) => (
        <li key={d.date} className="border-t-[0.5px] border-separator first:border-t-0">
          <a
            className="dt flex items-center gap-3 px-4 py-3.5 text-body"
            data-date={d.date}
            href={buildPath({ page: 'day', date: d.date, cat: null }, latest)}
            onClick={onLinkClick}
          >
            <span className="flex-1">
              {dateShort(d.date)} <span className="text-text-2">{weekdayCN(d.date)}</span>
            </span>
            <span className="text-footnote text-text-2">{d.story_count} 条</span>
            <Icon name="chev" size={16} className="text-text-3" />
          </a>
        </li>
      ))}
    </ul>
  );
}

/** 往期: date list, 趋势 (v5 trend view) and 周报 (F5, not built yet). Layout pending the designer's mock-up. */
export default function ArchivePage({
  tab,
  days,
  latest,
}: {
  tab: ArchiveTab;
  days: DaySummary[];
  latest: string | null;
}) {
  const [reload, setReload] = useState(0);
  const trend = useAsync(tab === 'trend' ? 'trends' : null, () => api.trends(), reload);
  let body: React.ReactNode;
  if (tab === 'daily') body = <DateList days={days} latest={latest} />;
  else if (tab === 'weekly')
    body = <EmptyState>周报正在开发中，上线后这里会显示每周 Top 10 和反复出现的话题。</EmptyState>;
  else if (trend.status === 'loading') body = <ListSkeleton n={2} />;
  else if (trend.status === 'error') body = <ErrorState onRetry={() => setReload((n) => n + 1)} />;
  else
    body = (
      <TrendView
        data={trend.data}
        dayHref={(d) => buildPath({ page: 'day', date: d, cat: null }, latest)}
        onSearch={(t) => navigate(buildPath({ page: 'search', q: t, cat: null }), { top: true })}
      />
    );
  return (
    <Main>
      <h1 id="title" className="mb-3 text-large lg:text-large-d">
        往期
      </h1>
      <div className="mb-4">
        <Segmented
          id="archiveTabs"
          label="往期"
          items={TABS}
          active={tab}
          onPick={(k) => navigate(buildPath({ page: 'archive', tab: k as ArchiveTab }), { replace: true })}
        />
      </div>
      {body}
      <Footnote />
    </Main>
  );
}
