#!/usr/bin/env node
// First-load JS budget (#16, PRD v6 §5): the gzip size of every script index.html loads up front
// (classic <script src>, <script type=module>, <link rel=modulepreload>) must stay <= the budget.
// Lazy route chunks are not counted. Usage: node scripts/check-bundle.mjs [distDir] [budgetBytes]
import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const dist = process.argv[2] || 'apps/web/dist';
const budget = Number(process.argv[3] || process.env.INITIAL_JS_GZIP_BUDGET || 60 * 1024);
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');

const urls = new Set();
for (const m of html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)) urls.add(m[1]);
for (const m of html.matchAll(/<link\b[^>]*\brel="modulepreload"[^>]*\bhref="([^"]+)"/g)) urls.add(m[1]);
for (const m of html.matchAll(/<link\b[^>]*\bhref="([^"]+)"[^>]*\brel="modulepreload"/g)) urls.add(m[1]);

let total = 0;
const rows = [];
for (const u of urls) {
  if (!u.startsWith('/')) throw new Error(`unexpected non-local script ${u}`);
  const f = path.join(dist, u);
  if (!fs.existsSync(f)) throw new Error(`index.html references a missing file: ${u}`);
  const buf = fs.readFileSync(f);
  const gz = gzipSync(buf, { level: 9 }).length;
  total += gz;
  rows.push(`  ${u}  ${(buf.length / 1024).toFixed(1)} KB  gzip ${(gz / 1024).toFixed(1)} KB`);
}
console.log(rows.join('\n'));
const line = `first-load JS: ${(total / 1024).toFixed(1)} KB gzip (budget ${(budget / 1024).toFixed(0)} KB, ${urls.size} files)`;
if (total > budget) {
  console.error('FAIL ' + line);
  process.exit(1);
}
console.log('OK ' + line);
