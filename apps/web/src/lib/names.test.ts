import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { displayName, hasKnownName } from './names.ts';

describe('displayName', () => {
  it('prefers the post `name` field, then the table, then the handle', () => {
    expect(displayName({ handle: 'karpathy', name: 'AK' })).toBe('AK');
    expect(displayName({ handle: 'karpathy' })).toBe('Andrej Karpathy');
    expect(displayName({ handle: 'nobody_xyz' })).toBe('nobody_xyz');
  });
  it('10-11 / 10-12 accounts are in the table', () => {
    expect(displayName({ handle: 'unusual_whales' })).toBe('unusual_whales');
    expect(displayName({ handle: 'daniel_mac8' })).toBe('Dan McAteer');
    expect(displayName({ handle: 'StepFun_ai' })).toBe('StepFun');
    expect(displayName({ handle: '22Astronauts_' })).toBe('22Astronauts');
    expect(displayName({ handle: 'fourweekmba' })).toBe('Gennaro');
    expect(displayName({ handle: 'NFT_Chen' })).toBe('SuSu_酥酥');
  });
  it('every account in data/*.json has a display name', () => {
    const dir = path.resolve(__dirname, '../../../../data');
    const missing = new Set<string>();
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      const day = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as {
        stories: { source_posts?: { handle: string; name?: string }[] }[];
      };
      for (const s of day.stories)
        for (const p of s.source_posts ?? []) if (!p.name && !hasKnownName(p.handle)) missing.add(p.handle);
    }
    expect([...missing]).toEqual([]);
  });
});
