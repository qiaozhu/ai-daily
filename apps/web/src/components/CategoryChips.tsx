import type { CategoryCount } from '../lib/categories.ts';

interface Props {
  total: number;
  categories: CategoryCount[];
  active: string | null;
  onPick: (cat: string | null) => void;
}

export function CategoryChips({ total, categories, active, onPick }: Props) {
  return (
    <>
      <button type="button" className={`chip ${!active ? 'on' : ''}`} data-cat="" onClick={() => onPick(null)}>
        全部<small>{total}</small>
      </button>
      {categories.map(({ category, count }) => (
        <button
          type="button"
          key={category}
          className={`chip ${active === category ? 'on' : ''}`}
          data-cat={category}
          onClick={() => onPick(category)}
        >
          {category}
          <small>{count}</small>
        </button>
      ))}
    </>
  );
}
