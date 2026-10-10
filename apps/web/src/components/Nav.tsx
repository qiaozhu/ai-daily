import { onLinkClick } from '../lib/router.ts';
import { TABS, type Page } from '../state/route.ts';
import { Icon, type IconName } from './Icon.tsx';
import { Logo } from './Logo.tsx';

const ICON: Record<Page, IconName> = { day: 'today', archive: 'past', search: 'search', me: 'me' };

interface Props {
  active: Page;
  favCount: number;
}

/** desktop (>= 1024px) left column: logo + vertical navigation, same 4 entries as the tab bar */
export function SideNav({ active, favCount }: Props) {
  return (
    <aside className="sticky top-0 hidden h-dvh py-7 lg:block" id="sidenav">
      <a href="/" onClick={onLinkClick} className="mb-7 ml-3 block" aria-label="AI 热点日报 首页">
        <Logo size={32} />
      </a>
      <nav aria-label="主导航" className="grid gap-0.5">
        {TABS.map((t) => {
          const on = t.page === active;
          return (
            <a
              key={t.page}
              href={t.path}
              data-tab={t.page}
              aria-current={on ? 'page' : undefined}
              onClick={onLinkClick}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-body transition-colors duration-200 ${
                on ? 'bg-brand-soft font-semibold text-brand-text' : 'font-medium text-text hover:bg-surface-2'
              }`}
            >
              <Icon name={ICON[t.page]} />
              <span className="flex-1">{t.label}</span>
              {t.page === 'me' && favCount > 0 && (
                <em className="text-footnote not-italic text-text-2" data-favcount="">
                  {favCount}
                </em>
              )}
            </a>
          );
        })}
      </nav>
    </aside>
  );
}

/** phone (< 1024px) bottom tab bar: 80% opaque + 20px blur, 0.5px separator, clears the home indicator */
export function TabBar({ active }: { active: Page }) {
  return (
    <nav
      id="tabbar"
      aria-label="主导航"
      className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t-[0.5px] border-separator bg-bar pt-2 pb-[max(8px,env(safe-area-inset-bottom))] backdrop-blur-[20px] lg:hidden"
    >
      {TABS.map((t) => {
        const on = t.page === active;
        return (
          <a
            key={t.page}
            href={t.path}
            data-tab={t.page}
            aria-current={on ? 'page' : undefined}
            onClick={onLinkClick}
            className={`flex w-[70px] flex-col items-center gap-[3px] text-[10px] leading-3 font-medium ${
              on ? 'text-brand' : 'text-text-2'
            }`}
          >
            <Icon name={ICON[t.page]} size={24} />
            {t.label}
          </a>
        );
      })}
    </nav>
  );
}
