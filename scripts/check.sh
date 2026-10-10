#!/usr/bin/env bash
# Lightweight checks (no secrets, no network to Cloudflare): build, syntax, data validation, assets, Worker bundle dry-run.
# Usage: bash scripts/check.sh [--no-bundle]
#   (TypeScript itself is checked by `pnpm typecheck` / `pnpm lint`, which scripts/ci-local.sh runs as separate steps.)
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
[ -d "$HOME/.local/node22/bin" ] && export PATH="$HOME/.local/node22/bin:$PATH"
export WRANGLER_SEND_METRICS=false
WEB_DIST=apps/web/dist
API_CONFIG=apps/api/wrangler.jsonc
echo "== node $(node -v) · pnpm $(pnpm -v)"
echo "== 前端构建（apps/web → $WEB_DIST）"
pnpm --filter @ai-daily/web build >/dev/null && echo "vite build OK"
echo "== 语法检查（脚本与测试）"
for f in scripts/json2sql.js tests/*.js; do node --check "$f"; done
for f in scripts/*.sh tests/*.sh; do if [ -f "$f" ]; then bash -n "$f"; fi; done
echo "== 数据校验（repo data/）"
node scripts/json2sql.js --all data >/dev/null && echo "data/ OK ($(ls data/*.json | wc -l) 天)"
echo "== 静态资源检查（$WEB_DIST）"
for f in index.html theme.js _headers brand/logo-icon.svg; do [ -f "$WEB_DIST/$f" ] || { echo "缺少 $WEB_DIST/$f"; exit 1; }; done
# every /assets/* file index.html references must exist (hashed names: no fixed list)
for u in $(grep -oE '(src|href)="/assets/[^"]+"' "$WEB_DIST/index.html" | sed -E 's/^(src|href)="\/(.*)"$/\2/'); do
  [ -f "$WEB_DIST/$u" ] || { echo "index.html 引用的 $u 不存在"; exit 1; }
done
grep -qE '<script[^>]+type="module"[^>]+src="/assets/' "$WEB_DIST/index.html" || { echo "index.html 缺少 /assets/ 入口脚本"; exit 1; }
echo "== 首屏 JS 体积上限（#16）"
node scripts/check-bundle.mjs "$WEB_DIST"
# CSP is script-src 'self': every <script> must have a src
if grep -noE '<script(\s[^>]*)?>' "$WEB_DIST/index.html" | grep -v 'src='; then echo "index.html 含内联脚本（违反 CSP script-src 'self'）"; exit 1; fi
if [ "${1:-}" != "--no-bundle" ]; then
  echo "== Worker 打包 dry-run（$API_CONFIG）"
  pnpm exec wrangler deploy -c "$API_CONFIG" --dry-run --outdir .wrangler/dry-run >/dev/null && echo "wrangler dry-run OK"
fi
echo "ALL CHECKS PASSED"
