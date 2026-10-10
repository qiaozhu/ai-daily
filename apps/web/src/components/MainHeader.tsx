import type { DaySummary } from '@ai-daily/shared';
import type { ReactNode } from 'react';
import { dateShort } from '../lib/format.ts';
import type { View } from '../state/route.ts';
import { Icon, type IconName } from './icons.tsx';
import type { Theme } from '../lib/theme.ts';
import { ThemeToggle } from './ThemeToggle.tsx';

const TOOLS: { v: View; icon: IconName; title: string }[] = [
  { v: 'search', icon: 'search', title: '搜索' },
  { v: 'fav', icon: 'bookmark', title: '收藏' },
  { v: 'trend', icon: 'trend', title: '趋势' },
];

interface Props {
  view: View;
  title: string;
  subtitle: ReactNode;
  date: string | null;
  days: DaySummary[];
  theme: Theme;
  exportUrl: string;
  onView: (v: View) => void;
  onDate: (date: string) => void;
  onToggleTheme: () => void;
}

/** sticky header of the middle column (on mobile it also carries the tools + date picker) */
export function MainHeader(p: Props) {
  return (
    <header className="mh">
      <div className="mtop">
        <div className="mtitle">
          <h1 id="title">{p.title}</h1>
          <div className="msub">
            <select
              id="mdate"
              className="mdate"
              aria-label="选择日期"
              value={p.date ?? ''}
              onChange={(e) => p.onDate(e.target.value)}
            >
              {p.days.map((d) => (
                <option key={d.date} value={d.date}>
                  {dateShort(d.date)}（{d.story_count}）
                </option>
              ))}
            </select>
            <p id="sub">{p.subtitle}</p>
          </div>
        </div>
        <div className="mtools">
          {TOOLS.map(({ v, icon, title }) => (
            <button
              type="button"
              key={v}
              className={`ib ${p.view === v ? 'on' : ''}`}
              data-v={v}
              title={title}
              onClick={() => p.onView(v)}
            >
              <Icon name={icon} />
            </button>
          ))}
          <a className="ib" href={p.exportUrl} download title="导出数据">
            <Icon name="download" />
          </a>
          <ThemeToggle theme={p.theme} onToggle={p.onToggleTheme} variant="icon" />
        </div>
      </div>
    </header>
  );
}
