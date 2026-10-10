#!/usr/bin/env bash
# Lightweight checks (no secrets, no network to Cloudflare): syntax, data validation, Worker bundle dry-run.
# Usage: bash scripts/check.sh [--no-bundle]
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
[ -d "$HOME/.local/node22/bin" ] && export PATH="$HOME/.local/node22/bin:$PATH"
echo "== node $(node -v)"
echo "== 语法检查"
node --input-type=module --check < src/worker.js
for f in public/app.js public/theme.js scripts/json2sql.js tests/*.js; do node --check "$f"; done
for f in scripts/*.sh; do bash -n "$f"; done
echo "== 数据校验（repo data/）"
node scripts/json2sql.js --all data >/dev/null && echo "data/ OK ($(ls data/*.json | wc -l) 天)"
echo "== 静态资源检查"
for f in index.html app.js style.css theme.js _headers; do [ -f "public/$f" ] || { echo "缺少 public/$f"; exit 1; }; done
if grep -n '<script>' public/index.html; then echo "index.html 含内联脚本（违反 CSP script-src 'self'）"; exit 1; fi
if [ "${1:-}" != "--no-bundle" ]; then
  echo "== Worker 打包 dry-run"
  WRANGLER_SEND_METRICS=false npx wrangler deploy --dry-run --outdir .wrangler/dry-run >/dev/null && echo "wrangler dry-run OK"
fi
echo "ALL CHECKS PASSED"
