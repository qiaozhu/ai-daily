import type { DaySummary } from '@ai-daily/shared';
import type { ReactNode } from 'react';
import type { View } from '../state/route.ts';
import { Icon, type IconName } from './icons.tsx';
import type { Theme } from '../lib/theme.ts';
import { ThemeToggle } from './ThemeToggle.tsx';

const ITEMS: { v: View; icon: IconName; label: string }[] = [
  { v: 'day', icon: 'home', label: '今日' },
  { v: 'search', icon: 'search', label: '搜索' },
  { v: 'fav', icon: 'bookmark', label: '收藏' },
  { v: 'trend', icon: 'trend', label: '趋势' },
];

interface Props {
  view: View;
  date: string | null;
  days: DaySummary[];
  favCount: number;
  theme: Theme;
  chips: ReactNode;
  exportUrl: string;
  onView: (v: View) => void;
  onDate: (date: string) => void;
  onToggleTheme: () => void;
}

/** desktop left column: navigation, history, category filter */
export function LeftNav(p: Props) {
  return (
    <nav className="lnav" aria-label="主导航">
      <div className="logo">
        <i>AI</i>
        <b>热点日报</b>
      </div>
      {ITEMS.map(({ v, icon, label }) => (
        <button
          type="button"
          key={v}
          className={`nv ${p.view === v ? 'on' : ''}`}
          data-v={v}
          onClick={() => p.onView(v)}
        >
          <Icon name={icon} />
          <span>{label}</span>
          {v === 'fav' && (
            <em className="cnt" id="favcnt">
              {p.favCount || ''}
            </em>
          )}
        </button>
      ))}
      <a className="nv" href={p.exportUrl} download>
        <Icon name="download" />
        <span>导出数据</span>
      </a>
      <ThemeToggle theme={p.theme} onToggle={p.onToggleTheme} variant="nav" />
      <div className="navsec">历史日报</div>
      <div className="dts" id="dates">
        {p.days.length ? (
          p.days.map((d) => (
            <button
              type="button"
              key={d.date}
              className={`dt ${p.view === 'day' && d.date === p.date ? 'on' : ''}`}
              data-date={d.date}
              onClick={() => p.onDate(d.date)}
            >
              {d.date}
              <small>{d.story_count} 条</small>
            </button>
          ))
        ) : (
          <div style={{ color: 'var(--sub)', padding: '0 12px' }}>暂无数据</div>
        )}
      </div>
      <div className="navsec">分类</div>
      <div className="chips" id="chips">
        {p.chips ?? <span style={{ color: 'var(--sub)', fontSize: 13 }}>—</span>}
      </div>
    </nav>
  );
}
