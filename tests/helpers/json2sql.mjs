// Runs scripts/json2sql.js in an isolated temp copy so it never writes into the repo's sql/ folder.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SCRIPT = path.join(ROOT, 'scripts', 'json2sql.js');

/** Make a sandbox: <tmp>/scripts/json2sql.js (+ <tmp>/data). Output goes to <tmp>/sql. */
export function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-daily-json2sql-'));
  fs.mkdirSync(path.join(dir, 'scripts'));
  fs.mkdirSync(path.join(dir, 'data'));
  fs.copyFileSync(SCRIPT, path.join(dir, 'scripts', 'json2sql.js'));
  return {
    dir,
    dataDir: path.join(dir, 'data'),
    /** write a day file; `content` may be an object (JSON-encoded) or a raw string */
    write(name, content) {
      const f = path.join(dir, 'data', name);
      fs.writeFileSync(f, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
      return f;
    },
    run(args) {
      const r = spawnSync(process.execPath, [path.join(dir, 'scripts', 'json2sql.js'), ...args], {
        cwd: dir, encoding: 'utf8', env: { ...process.env, DATA_DIR: '' },
      });
      return { status: r.status, stdout: r.stdout, stderr: r.stderr };
    },
    sql(name) { return fs.readFileSync(path.join(dir, 'sql', name), 'utf8'); },
    hasSql(name) { return fs.existsSync(path.join(dir, 'sql', name)); },
    cleanup() { fs.rmSync(dir, { recursive: true, force: true }); },
  };
}

/** Convert the given JSON files (absolute paths) to one SQL string via the real script. */
export function json2sqlFiles(files) {
  const sb = sandbox();
  try {
    for (const f of files) fs.copyFileSync(f, path.join(sb.dataDir, path.basename(f)));
    const r = sb.run(['--all', sb.dataDir]);
    if (r.status !== 0) throw new Error('json2sql failed:\n' + r.stderr + r.stdout);
    return sb.sql('all.sql');
  } finally { sb.cleanup(); }
}

/** Minimal day object that passes json2sql validation. */
export function minimalDay(date = '2026-01-01', overrides = {}) {
  return {
    date, generated_at: `${date}T10:00:00+08:00`, timezone: 'Asia/Shanghai', source: 'test',
    highlights: ['h1'], data_quality_notes: [],
    stories: [{
      id: `${date}-a`, headline_zh: '标题', summary_zh: '摘要', why_it_matters: 'w', org_tag: 'Org',
      categories: ['大模型'], topics: ['T'], heat: 1,
      source_posts: [{ handle: 'u', post_id: '1', url: 'https://x.com/u/status/1', text: 't', lang: 'en', translation_zh: '译', likes: 1, reposts: 2, replies: 3, views: 4 }],
      news_refs: [], data_quality: null,
    }],
    ...overrides,
  };
}
