import type { Story } from '@ai-daily/shared';
import { countCategories, filterByCategory } from '../lib/categories.ts';
import { Segmented } from './Segmented.tsx';
import { EmptyState } from './States.tsx';
import { StoryCard } from './StoryCard.tsx';

/** "全部 + the categories present" segmented filter; scrolls horizontally on phones */
export function CategoryFilter({
  pool,
  cat,
  onCat,
}: {
  pool: readonly Story[];
  cat: string | null;
  onCat: (c: string | null) => void;
}) {
  const items = [
    { key: '', label: '全部' },
    ...countCategories([...pool]).map((c) => ({ key: c.category, label: c.category })),
  ];
  return <Segmented id="cats" label="分类" items={items} active={cat ?? ''} onPick={(k) => onCat(k || null)} />;
}

interface Props<T extends Story> {
  stories: readonly T[];
  cat: string | null;
  title: string;
  showDate?: boolean;
  /** two columns from 1024px (home page) */
  twoCols?: boolean;
  empty: string;
}

export function StoryList<T extends Story>({ stories, cat, title, showDate, twoCols, empty }: Props<T>) {
  // API order, no sort control: a day is in editorial `rank` order (PRD F1, like v5; hifi-v1 §1.5 as revised
  // in #20), search results newest day first, favorites newest first
  const list = filterByCategory([...stories], cat);
  return (
    <section>
      <div className="mb-2.5">
        <h2 className="text-title2">{title}</h2>
      </div>
      {list.length ? (
        <div id="tl" className={`grid items-start gap-3 ${twoCols ? 'lg:grid-cols-2 lg:gap-3.5' : ''}`}>
          {list.map((s) => (
            <StoryCard key={s.id} story={s} showDate={showDate} />
          ))}
        </div>
      ) : (
        <div id="tl">
          <EmptyState>{empty}</EmptyState>
        </div>
      )}
    </section>
  );
}
