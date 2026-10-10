import { splitHighlights } from '../lib/highlight.ts';
import { useUi } from '../state/ui-context.ts';

/** text with the current search terms wrapped in <mark> */
export function Highlight({ text }: { text: string | null | undefined }) {
  const { terms } = useUi();
  return <>{splitHighlights(text, terms).map((s, i) => (s.match ? <mark key={i}>{s.text}</mark> : s.text))}</>;
}
