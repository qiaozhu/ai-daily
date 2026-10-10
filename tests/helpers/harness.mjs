// Starts the real Worker (src/worker.js via wrangler.jsonc) locally with wrangler's createTestHarness:
// in-memory D1 + Static Assets, no Cloudflare credentials, no network to Cloudflare.
import { createTestHarness, unstable_splitSqlQuery } from 'wrangler';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, json2sqlFiles } from './json2sql.mjs';

process.env.WRANGLER_SEND_METRICS ??= 'false';
delete process.env.CLOUDFLARE_API_TOKEN; // make sure nothing could ever talk to the real account
delete process.env.CLOUDFLARE_ACCOUNT_ID;

export const REAL_DAY = path.join(ROOT, 'data', '2026-10-10.json');
export const FIXTURE_DAY = path.join(ROOT, 'tests', 'fixtures', '2026-10-09.json');
export const FIXTURE_DAY_2 = path.join(ROOT, 'tests', 'fixtures', '2026-10-08.json');
export const SEED_FILES = [FIXTURE_DAY_2, FIXTURE_DAY, REAL_DAY];
export const readJSON = f => JSON.parse(fs.readFileSync(f, 'utf8'));

let ipSeq = 0;
/** unique client IP per call so the per-IP favorites throttle (30/min) never interferes */
export const freshIp = () => `10.0.${(process.pid % 250)}.${(++ipSeq % 250) + 1}`;

export async function seed(db, files = SEED_FILES) {
  const sql = json2sqlFiles(files);
  const stmts = unstable_splitSqlQuery(sql).filter(s => s.trim());
  // D1 batch = one implicit transaction, same as `wrangler d1 execute --file`
  for (let i = 0; i < stmts.length; i += 50) await db.batch(stmts.slice(i, i + 50).map(s => db.prepare(s)));
}

/**
 * @param {{vars?: Record<string,string>, seedFiles?: string[]|null}} opts  seedFiles=null -> empty DB
 */
export async function startApi(opts = {}) {
  const server = createTestHarness({
    root: ROOT,
    workers: [{ configPath: './wrangler.jsonc', vars: opts.vars }],
  });
  const { url } = await server.listen();
  const worker = server.getWorker();
  await worker.applyD1Migrations('DB');
  const env = await worker.getEnv();
  if (opts.seedFiles !== null) await seed(env.DB, opts.seedFiles || SEED_FILES);
  const base = String(url).replace(/\/$/, '');
  return {
    server, env, db: env.DB, base,
    /** fetch relative to the local server; JSON-decodes when possible */
    async req(p, init = {}) {
      const headers = { 'CF-Connecting-IP': freshIp(), ...(init.headers || {}) };
      const res = await server.fetch(p, { ...init, headers });
      const text = await res.text();
      let body; try { body = JSON.parse(text); } catch { body = undefined; }
      return { status: res.status, headers: res.headers, text, body };
    },
    close: () => server.close(),
  };
}
