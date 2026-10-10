import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { CARD_SIZES, IS_PLACEHOLDER, cardKey, renderCard } from './index.ts';

const story = { id: '2026-10-10-x', headline_zh: '标题' };
const day = { date: '2026-10-10', highlights: ['a'], stories: [story] };

function readPng(bytes: Uint8Array) {
  const b = Buffer.from(bytes);
  expect(b.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(b.subarray(12, 16).toString('latin1')).toBe('IHDR');
  const width = b.readUInt32BE(16);
  const height = b.readUInt32BE(20);
  const idatLen = b.readUInt32BE(33);
  expect(b.subarray(37, 41).toString('latin1')).toBe('IDAT');
  const raw = inflateSync(b.subarray(41, 41 + idatLen));
  return { width, height, raw };
}

describe('renderCard (F2 placeholder)', () => {
  for (const kind of ['day', 'story'] as const)
    for (const size of ['og', 'save'] as const)
      it(`${kind} ${size} -> valid PNG of the exact size`, async () => {
        const data = kind === 'day' ? day : { day, story };
        const png = await renderCard({ kind, size, data } as Parameters<typeof renderCard>[0]);
        expect(png).toBeInstanceOf(Uint8Array);
        const { width, height, raw } = readPng(png);
        expect({ width, height }).toEqual(CARD_SIZES[size]);
        expect(raw.length).toBe((1 + width * 3) * height);
        expect([...raw.subarray(1, 4)]).toEqual([0x7d, 0x5a, 0xf0]);
      });
  it('rejects unknown sizes / kinds', async () => {
    await expect(renderCard({ kind: 'day', size: 'huge' as 'og', data: day })).rejects.toThrow();
    await expect(renderCard({ kind: 'week' as 'day', size: 'og', data: day })).rejects.toThrow();
  });
  it('cardKey + IS_PLACEHOLDER', () => {
    expect(cardKey('story', '2026-10-10-x', 'save')).toBe('card/story/2026-10-10-x/save.png');
    expect(cardKey('day', '2026-10-10', 'og')).toBe('card/day/2026-10-10/og.png');
    expect(IS_PLACEHOLDER).toBe(true);
  });
});
