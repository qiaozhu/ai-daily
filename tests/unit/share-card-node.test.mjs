// Contract for the pre-render script (PR #22): plain Node .mjs code imports packages/share-card/src/index.ts by file
// URL (no bundler, no build step) and gets a working named export `renderCard`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL, fileURLToPath } from 'node:url';

const entry = fileURLToPath(new URL('../../packages/share-card/src/index.ts', import.meta.url));

test('share-card entry is importable from Node .mjs and renders PNGs of the right size', async () => {
  const mod = await import(pathToFileURL(entry).href);
  assert.equal(typeof mod.renderCard, 'function');
  assert.equal(mod.cardKey('day', '2026-10-10', 'og'), 'card/day/2026-10-10/og.png');
  const day = { date: '2026-10-10', stories: [{ id: '2026-10-10-x', headline_zh: '标题' }] };
  for (const [kind, data] of [['day', day], ['story', { day, story: day.stories[0] }]])
    for (const [size, w, h] of [['og', 1200, 630], ['save', 1080, 1440]]) {
      const png = Buffer.from(await mod.renderCard({ kind, size, data }));
      assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
      assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [w, h], `${kind} ${size}`);
    }
});
