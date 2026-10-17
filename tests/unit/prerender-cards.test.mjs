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

import { parseCli } from '../../scripts/prerender-cards.mjs';

test('parseCli: --env is required and must be production|preview', () => {
  assert.throws(() => parseCli(['2026-10-10']), /--env/);
  assert.throws(() => parseCli(['2026-10-10', '--env']), /argument missing|--env/);
  assert.throws(() => parseCli(['2026-10-10', '--env', 'prod']), /--env/);
  assert.throws(() => parseCli(['2026-10-10', '--env', '--dry-run']), /./);
});

test('parseCli: unknown flags and bad dates are rejected', () => {
  assert.throws(() => parseCli(['2026-10-10', '--env', 'preview', '--envv', 'x']), /Unknown option|用法/);
  assert.throws(() => parseCli(['2026-10-10', '--env', 'preview', '--dryrun']), /Unknown option|用法/);
  assert.throws(() => parseCli(['10-10', '--env', 'preview']), /日期/);
  assert.throws(() => parseCli(['2026-10-10', '2026-10-11', '--env', 'preview']), /日期/);
});

test('parseCli: valid forms, including --env=preview', () => {
  assert.equal(parseCli(['2026-10-10', '--env=preview']).env, 'preview');
  assert.equal(parseCli(['--env', 'production', '2026-10-10']).env, 'production');
  const c = parseCli(['2026-10-10', '--env', 'preview', '--dry-run']);
  assert.equal(c.dry, true);
  assert.equal(c.date, '2026-10-10');
});

import { loadRenderer } from '../../scripts/prerender-cards.mjs';

test('loadRenderer: the share-card skeleton (IS_PLACEHOLDER) still counts as placeholder (production guard)', async () => {
  const r = await loadRenderer();
  const { IS_PLACEHOLDER } = await import('../../packages/share-card/src/index.ts');
  assert.equal(r.name, IS_PLACEHOLDER ? 'placeholder' : 'share-card');
  const png = Buffer.from(await r.render({ kind: 'story', size: 'og', data: { story: { id: 'x', headline_zh: 'x' } } }));
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
});
