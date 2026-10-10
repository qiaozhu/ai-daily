import { useCallback, useState } from 'react';

/** which cards are expanded (several may be open) */
export function useExpanded() {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const toggle = useCallback(
    (id: string) =>
      setOpen((o) => {
        const n = new Set(o);
        if (n.has(id)) n.delete(id);
        else n.add(id);
        return n;
      }),
    [],
  );
  const show = useCallback((id: string) => setOpen((o) => (o.has(id) ? o : new Set(o).add(id))), []);
  return { open, toggle, show };
}

export type Expanded = ReturnType<typeof useExpanded>;
