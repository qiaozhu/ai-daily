import { Icon } from './Icon.tsx';

export const FOOTNOTE = '数据来自 X 平台公开内容 · 互动数为抓取时数值 · 时间为北京时间（UTC+8）';

/** middle column (phone: the whole page, leaves room for the tab bar) */
export function Main({ children }: { children: React.ReactNode }) {
  return (
    <main
      id="mainCol"
      className="min-w-0 px-[18px] pt-[max(14px,env(safe-area-inset-top))] pb-[110px] lg:px-0 lg:pt-10 lg:pb-16"
    >
      {children}
    </main>
  );
}

/** desktop right column (>= 1280px only) */
export function Aside({ children }: { children?: React.ReactNode }) {
  return <aside className="rcol hidden pt-[118px] pb-10 xl:block">{children}</aside>;
}

export function Footnote({ className = '' }: { className?: string }) {
  return <p className={`foot mt-6 text-caption font-normal text-text-2 ${className}`}>{FOOTNOTE}</p>;
}

/** 34px round icon button (surface-2) */
export function IconButton({ icon, label, onClick }: { icon: 'share' | 'search'; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-[34px] items-center justify-center rounded-full bg-surface-2 text-brand-text active:scale-[.97]"
    >
      <Icon name={icon} size={17} />
    </button>
  );
}

export function Toast({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-28 z-30 mx-auto w-fit rounded-tag bg-text px-4 py-2 text-footnote text-bg lg:bottom-10"
    >
      {text}
    </div>
  );
}
