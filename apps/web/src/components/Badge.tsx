import { badgeLabel } from '../lib/stories.ts';

/** "新" (brand-soft / brand-text) or "持续热议 N 天" (hot 12% / hot-text); nothing otherwise (spec §7) */
export function StatusBadge({ story }: { story: { badge?: 'new' | 'ongoing' | null; streak_days?: number | null } }) {
  const label = badgeLabel(story);
  if (!label) return null;
  const hot = story.badge === 'ongoing';
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-tag px-[9px] py-[3px] text-caption whitespace-nowrap ${
        hot ? 'bg-hot/12 text-hot-text' : 'bg-brand-soft text-brand-text'
      }`}
      data-badge={story.badge}
    >
      {label}
    </span>
  );
}

/** neutral tag (category) */
export function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-tag bg-surface-2 px-[9px] py-[3px] text-caption whitespace-nowrap text-text-2">
      {children}
    </span>
  );
}
