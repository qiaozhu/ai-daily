// Share card renderer — the contract between the Worker (/og/*), the pre-render script (scripts/prerender-cards.mjs,
// PR #22) and F3. Entry point: packages/share-card/src/index.ts, named export `renderCard`.
//
// Runs directly in Node 22 (>= 22.18 strips TypeScript types by default; 22.12–22.17 need --experimental-strip-types):
//   const { renderCard, cardKey, IS_PLACEHOLDER } = await import(pathToFileURL('packages/share-card/src/index.ts').href);
// Only erasable TypeScript is used (tsconfig erasableSyntaxOnly) and every relative import carries its .ts extension.
// F3 rule: load wasm and fonts with node:fs from file paths (never Worker-only `import x from './a.wasm'`).
//
// F2 status: PLACEHOLDER. renderCard returns a solid brand-purple PNG of the exact size; IS_PLACEHOLDER is true so
// callers can refuse to publish placeholders (e.g. to production KV).
import { encodeSolidPng } from './png.ts';

export type CardKind = 'day' | 'story';
/** og = landscape 1200×630 (og:image); save = portrait 1080×1440 ("保存分享图", `?size=portrait`) */
export type CardSize = 'og' | 'save';

export const CARD_SIZES: Readonly<Record<CardSize, { width: number; height: number }>> = {
  og: { width: 1200, height: 630 },
  save: { width: 1080, height: 1440 },
};

/** Minimal shape of a day JSON story the cards use (the full daily JSON / API objects are accepted as well). */
export interface CardStory {
  id: string;
  date?: string;
  headline_zh: string;
  summary_zh?: string;
  heat?: number | null;
  org_tag?: string | null;
}
/** kind 'day': the day JSON ({ date, highlights, stories, … }) */
export interface DayCardData {
  date: string;
  highlights?: readonly string[];
  stories: readonly CardStory[];
}
/** kind 'story': the story plus its day */
export interface StoryCardData {
  day: DayCardData;
  story: CardStory;
}

export type RenderCardInput =
  { kind: 'day'; size: CardSize; data: DayCardData } | { kind: 'story'; size: CardSize; data: StoryCardData };

/** true until F3 replaces the placeholder renderer */
export const IS_PLACEHOLDER = true;

/** brand purple #7D5AF0 (visual spec v1) */
const BRAND: readonly [number, number, number] = [0x7d, 0x5a, 0xf0];

/** Render one card as PNG bytes. F2: placeholder (solid brand colour, exact size). */
export async function renderCard(input: RenderCardInput): Promise<Uint8Array> {
  const size = CARD_SIZES[input.size];
  if (!size) throw new Error(`unknown card size: ${String(input.size)}`);
  const kind: string = input.kind;
  if (kind !== 'day' && kind !== 'story') throw new Error(`unknown card kind: ${kind}`);
  return encodeSolidPng(size.width, size.height, BRAND);
}

/** KV key used by the Worker and the pre-render script: card/{kind}/{id or date}/{og|save}.png */
export const cardKey = (kind: CardKind, idOrDate: string, size: CardSize): string =>
  `card/${kind}/${idOrDate}/${size}.png`;
