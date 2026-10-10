// Loading / empty / error states (hifi-v1 §3): skeletons in surface-2 (no spinner), short copy, no technical detail.

function Bone({ className = '' }: { className?: string }) {
  return <div className={`rounded-md bg-surface-2 ${className}`} />;
}

export function CardSkeleton() {
  return (
    <div className="rounded-card bg-surface p-4 shadow-card" aria-hidden="true">
      <Bone className="mb-3 h-4 w-28" />
      <Bone className="mb-2 h-5 w-full" />
      <Bone className="mb-3 h-5 w-3/4" />
      <Bone className="mb-1.5 h-4 w-full" />
      <Bone className="h-4 w-2/3" />
    </div>
  );
}

export function ListSkeleton({ n = 3 }: { n?: number }) {
  return (
    <div className="grid gap-3" data-state="loading" aria-busy="true" aria-label="加载中">
      {Array.from({ length: n }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export function HeroSkeleton() {
  return (
    <div className="rounded-hero bg-surface p-[18px] shadow-card" aria-hidden="true">
      <Bone className="mb-4 h-4 w-24" />
      {[0, 1, 2].map((i) => (
        <Bone key={i} className="mb-3 h-10 w-full" />
      ))}
    </div>
  );
}

interface EmptyProps {
  children: React.ReactNode;
  action?: { label: string; onClick: () => void };
  state?: 'empty' | 'error';
}

export function EmptyState({ children, action, state = 'empty' }: EmptyProps) {
  return (
    <div
      className="flex flex-col items-center gap-4 rounded-card bg-surface px-6 py-10 text-center shadow-card"
      data-state={state}
    >
      <p className="text-body text-text-2">{children}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="h-11 rounded-button bg-brand-soft px-5 text-body font-semibold text-brand-text active:scale-[.97]"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <EmptyState state="error" action={{ label: '重试', onClick: onRetry }}>
      加载失败
    </EmptyState>
  );
}
