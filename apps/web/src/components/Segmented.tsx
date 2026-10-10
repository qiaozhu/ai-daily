export interface SegItem {
  key: string;
  label: React.ReactNode;
}

interface Props {
  items: readonly SegItem[];
  active: string;
  onPick: (key: string) => void;
  label: string;
  id?: string;
}

/**
 * Segmented control (spec §7): surface-2 track (radius 10), selected block on surface/#636366 (radius 8).
 * Items never shrink: when they do not fit (phone, many categories) the control scrolls horizontally.
 */
export function Segmented({ items, active, onPick, label, id }: Props) {
  return (
    <div
      id={id}
      role="tablist"
      aria-label={label}
      className="no-scrollbar flex overflow-x-auto rounded-control bg-surface-2 p-0.5"
    >
      {items.map((it) => {
        const on = it.key === active;
        return (
          <button
            key={it.key}
            type="button"
            role="tab"
            aria-selected={on}
            data-key={it.key}
            onClick={() => onPick(it.key)}
            className={`flex-[1_0_auto] rounded-lg px-3 py-1.5 text-footnote whitespace-nowrap transition-colors duration-200 ease-standard ${
              on ? 'bg-seg-on font-semibold shadow-[0_1px_3px_rgb(0_0_0/0.12)]' : 'font-medium text-text'
            }`}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
