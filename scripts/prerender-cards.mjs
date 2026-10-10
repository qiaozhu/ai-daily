#!/usr/bin/env node
// Pre-render share cards for one day and upload them to Workers KV (binding CARDS).
// Runs in Node (no Worker CPU limit). Called after daily.sh by the daily pipeline; daily.sh itself is untouched.
//
// Usage: node scripts/prerender-cards.mjs <YYYY-MM-DD> --env production|preview [--dry-run] [--out <dir>]
//   --env          REQUIRED: which KV namespace to write (production | preview). Unknown flags are rejected.
//   --dry-run      render only, write PNGs to --out (default .cards/<date>/), no Cloudflare calls
// Exit code is non-zero on any failure. It is independent of daily.sh: the pipeline should run it AFTER daily.sh
// and only log a failure (e.g. `node scripts/prerender-cards.mjs "$DATE" --env production || echo "prerender failed" >&2`),
// so a card problem never blocks or rolls back the day's data. Placeholder cards are refused for production.
// Env: DATA_DIR (day JSON dir, from scripts/env.sh), CLOUDFLARE_API_TOKEN (not needed for --dry-run).
//
// KV keys: card/day/<date>/<size>.png and card/story/<story id>/<size>.png, size = og (1200x630) | save (1080x1440).
// Cards expire after CARD_TTL_DAYS; they can always be regenerated from the day JSON by re-running this script.
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { deflateSync, crc32 } from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

export const SIZES = { og: [1200, 630], save: [1080, 1440] };
export const CARD_TTL_DAYS = 180;
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CFG = join(REPO, 'apps/api/wrangler.jsonc');

export function cardKey(kind, idOrDate, size) {
  return `card/${kind}/${idOrDate}/${size}.png`;
}

// Every card to render for a day: 1 day card + 1 per story, each in both sizes.
export function planCards(day) {
  const jobs = [];
  for (const size of Object.keys(SIZES)) {
    jobs.push({ kind: 'day', size, key: cardKey('day', day.date, size), data: day });
    for (const s of day.stories) jobs.push({ kind: 'story', size, key: cardKey('story', s.id, size), data: { day, story: s } });
  }
  return jobs;
}

// Minimal valid PNG (solid brand colour) used until packages/share-card exists.
export function placeholderPng(w, h, [r, g, b] = [0x7d, 0x5a, 0xf0]) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  const row = Buffer.alloc(1 + w * 3);
  for (let x = 0; x < w; x++) { row[1 + x * 3] = r; row[2 + x * 3] = g; row[3 + x * 3] = b; }
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

async function loadRenderer() {
  const entry = join(REPO, 'packages/share-card/src/index.ts');
  if (existsSync(entry)) {
    const mod = await import(pathToFileURL(entry).href);
    if (typeof mod.renderCard === 'function') return { name: 'share-card', render: mod.renderCard };
  }
  return { name: 'placeholder', render: ({ size }) => placeholderPng(...SIZES[size]) };
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function withRetry(label, fn, attempts = 3) {
  for (let i = 1; ; i++) {
    try { return await fn(); } catch (e) {
      if (i >= attempts) throw new Error(`${label} 失败（已重试 ${attempts} 次）：${e.message}`);
      console.error(`${label} 第 ${i} 次失败，${5 * i}s 后重试：${e.message.split('\n')[0]}`);
      await sleep(5000 * i);
    }
  }
}

const USAGE = '用法: node scripts/prerender-cards.mjs <YYYY-MM-DD> --env production|preview [--dry-run] [--out <dir>] [--allow-placeholder]';

// Strict CLI parsing: unknown flags, a missing/invalid --env, or a malformed date are errors (never default to production).
export function parseCli(argv) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      strict: true,
      options: {
        env: { type: 'string' },
        'dry-run': { type: 'boolean', default: false },
        out: { type: 'string' },
        'allow-placeholder': { type: 'boolean', default: false },
      },
    });
  } catch (e) {
    throw new Error(`${e.message}\n${USAGE}`);
  }
  const { values, positionals } = parsed;
  if (positionals.length !== 1 || !/^\d{4}-\d{2}-\d{2}$/.test(positionals[0])) throw new Error(`需要且只能有一个日期参数 YYYY-MM-DD\n${USAGE}`);
  if (values.env !== 'production' && values.env !== 'preview') throw new Error(`--env 必须是 production 或 preview\n${USAGE}`);
  return {
    date: positionals[0],
    env: values.env,
    dry: values['dry-run'],
    out: values.out ? resolve(values.out) : join(REPO, '.cards', positionals[0]),
    allowPlaceholder: values['allow-placeholder'],
  };
}

async function main(argv) {
  const { date, env, dry, out, allowPlaceholder } = parseCli(argv);
  const dataDir = process.env.DATA_DIR || join(REPO, 'data');
  const file = join(dataDir, `${date}.json`);
  if (!existsSync(file)) { console.error(`找不到 ${file}`); process.exit(1); }
  const day = JSON.parse(readFileSync(file, 'utf8'));
  if (day.date !== date || !Array.isArray(day.stories)) { console.error(`${file} 内容与日期不符或缺少 stories`); process.exit(1); }

  const renderer = await loadRenderer();
  const jobs = planCards(day);
  console.log(`== ${date}：${day.stories.length} 条话题，共 ${jobs.length} 张卡（渲染器：${renderer.name}）`);
  mkdirSync(out, { recursive: true });
  const entries = [];
  let bytes = 0;
  for (const job of jobs) {
    const png = Buffer.from(await renderer.render({ kind: job.kind, size: job.size, data: job.data }));
    if (png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error(`${job.key} 渲染结果不是 PNG`);
    bytes += png.length;
    writeFileSync(join(out, job.key.replaceAll('/', '__')), png);
    entries.push({ key: job.key, value: png.toString('base64'), base64: true, expiration_ttl: CARD_TTL_DAYS * 86400 });
  }
  console.log(`渲染完成：${(bytes / 1024).toFixed(1)} KB，本地副本在 ${out}`);
  if (dry) { console.log('[dry-run] 未连接 Cloudflare'); return; }
  if (renderer.name === 'placeholder' && env === 'production' && !allowPlaceholder) {
    console.error('packages/share-card 还没上线，拒绝把占位图写进生产 KV（预览可用 --env preview，确需写入加 --allow-placeholder）');
    process.exit(1);
  }
  if (!process.env.CLOUDFLARE_API_TOKEN) { console.error('需要 CLOUDFLARE_API_TOKEN（先 source scripts/env.sh）'); process.exit(1); }

  const bulk = join(out, 'kv-bulk.json');
  writeFileSync(bulk, JSON.stringify(entries));
  const args = ['wrangler', 'kv', 'bulk', 'put', bulk, '--binding', 'CARDS', '--remote', '-c', CFG, ...(env === 'preview' ? ['--env', 'preview'] : [])];
  try {
    await withRetry('写入 KV', async () => execFileSync('npx', args, { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'] }));
  } finally { rmSync(bulk, { force: true }); }
  console.log(`OK 已写入 ${env === 'preview' ? '预览' : '生产'} KV：${entries.length} 个 key（${CARD_TTL_DAYS} 天后过期）`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((e) => { console.error(e.message); process.exit(e.message.includes('用法') ? 2 : 1); });
}
