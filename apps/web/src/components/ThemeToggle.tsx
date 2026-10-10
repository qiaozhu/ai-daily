import type { Theme } from '../lib/theme.ts';
import { Icon } from './icons.tsx';

interface Props {
  theme: Theme;
  onToggle: () => void;
  variant: 'nav' | 'icon';
}

export function ThemeToggle({ theme, onToggle, variant }: Props) {
  return (
    <button
      type="button"
      className={variant === 'nav' ? 'nv themebtn' : 'ib themebtn'}
      data-theme-toggle=""
      title="切换浅色/深色"
      onClick={onToggle}
    >
      <Icon name="moon" className="i-moon" />
      <Icon name="sun" className="i-sun" />
      {variant === 'nav' && <span className="themelabel">{theme === 'dark' ? '浅色模式' : '深色模式'}</span>}
    </button>
  );
}
