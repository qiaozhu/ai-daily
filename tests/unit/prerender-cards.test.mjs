import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planCards, cardKey, placeholderPng, SIZES } from '../../scripts/prerender-cards.mjs';

const day = { date: '2026-10-10', stories: [{ id: '2026-10-10-a' }, { id: '2026-10-10-b' }] };

test('planCards: 1 day card + 1 per story, both sizes', () => {
  const jobs = planCards(day);
  assert.equal(jobs.length, (1 + day.stories.length) * Object.keys(SIZES).length);
  const keys = jobs.map((j) => j.key);
  assert.equal(new Set(keys).size, keys.length, 'keys are unique');
  assert.ok(keys.includes('card/day/2026-10-10/og.png'));
  assert.ok(keys.includes('card/story/2026-10-10-b/save.png'));
});

test('cardKey format', () => {
  assert.equal(cardKey('story', 'x', 'og'), 'card/story/x/og.png');
});

test('placeholderPng is a PNG with the requested size', () => {
  const png = placeholderPng(1200, 630);
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
});
