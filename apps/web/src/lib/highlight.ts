/** split `text` into plain/match segments for case-insensitive highlighting of search terms */
export interface Segment {
  text: string;
  match: boolean;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function splitHighlights(text: string | null | undefined, terms: string[]): Segment[] {
  const t = String(text ?? '');
  const tm = terms.filter(Boolean);
  if (!tm.length) return [{ text: t, match: false }];
  const re = new RegExp('(' + tm.map(escapeRe).join('|') + ')', 'gi');
  // split() with one capture group: odd indices are the captured matches
  return t
    .split(re)
    .map((s, i) => ({ text: s, match: i % 2 === 1 }))
    .filter((s) => s.text !== '');
}

export const queryTerms = (q: string): string[] => q.split(/\s+/).filter(Boolean);
