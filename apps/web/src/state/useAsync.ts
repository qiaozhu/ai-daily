import { useEffect, useState } from 'react';

export type AsyncState<T> = { status: 'loading' } | { status: 'error'; error: unknown } | { status: 'ready'; data: T };

/**
 * Loads `fn()` whenever `key` changes (null = do not load). Stale responses are dropped and the previous
 * key's data is never shown for a new key (loading instead). Bump `reload` to refetch.
 */
export function useAsync<T>(key: string | null, fn: () => Promise<T>, reload = 0): AsyncState<T> {
  const k = key === null ? null : `${key}#${reload}`;
  const [state, setState] = useState<{ key: string | null; value: AsyncState<T> }>({
    key: null,
    value: { status: 'loading' },
  });
  useEffect(() => {
    if (k === null) return;
    let alive = true;
    fn().then(
      (data) => alive && setState({ key: k, value: { status: 'ready', data } }),
      (error: unknown) => alive && setState({ key: k, value: { status: 'error', error } }),
    );
    return () => {
      alive = false;
    };
    // fn is recreated every render; `k` captures everything it depends on
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k]);
  return state.key === k ? state.value : { status: 'loading' };
}
