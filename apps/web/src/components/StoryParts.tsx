import type { Story } from '@ai-daily/shared';
import { useUi } from '../state/ui-context.ts';
import { Icon } from './icons.tsx';

export function StarButton({ id }: { id: string }) {
  const { favs, pending, toggleFav } = useUi();
  const on = favs.has(id);
  return (
    <button
      type="button"
      className={`star ${on ? 'on' : ''}`}
      data-fav={id}
      title={on ? '取消收藏' : '收藏'}
      aria-pressed={on}
      disabled={pending.has(id)}
      onClick={(e) => {
        e.stopPropagation();
        toggleFav(id);
      }}
    >
      <Icon name="starO" className="o" />
      <Icon name="starF" className="f" />
    </button>
  );
}

export function Categories({ story }: { story: Story }) {
  return (
    <>
      {(story.categories || []).map((c, i) => (
        <span className="cat" key={i}>
          {c}
        </span>
      ))}
    </>
  );
}

export function NewsLinks({ story }: { story: Story }) {
  return (
    <>
      {(story.news_refs || []).map((u, i) => (
        <a key={i} href={u} target="_blank" rel="noopener noreferrer">
          X 新闻 {i + 1} ↗
        </a>
      ))}
    </>
  );
}
