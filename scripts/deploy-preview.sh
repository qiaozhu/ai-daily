#!/usr/bin/env bash
# Deploy the current checkout to the PREVIEW environment (Worker `ai-daily-preview` + D1 `ai-daily-preview`).
# Never touches production. Safe for any bot to run on its own PR branch.
# Usage: scripts/deploy-preview.sh [--sync-data]
#   --sync-data  apply migrations and re-import every day JSON from $DATA_DIR into the preview D1 (idempotent).
# Env: CLOUDFLARE_API_TOKEN (required; never commit it).
set -euo pipefail
SYNC=0; [ "${1:-}" = "--sync-data" ] && SYNC=1
# shellcheck source=scripts/env.sh
source "$(dirname "${BASH_SOURCE[0]}")/env.sh"
: "${CLOUDFLARE_API_TOKEN:?需要 CLOUDFLARE_API_TOKEN}"; : "${CLOUDFLARE_ACCOUNT_ID:?无法获取 CLOUDFLARE_ACCOUNT_ID}"
CFG=apps/api/wrangler.jsonc
W="npx wrangler"
if [ "$SYNC" = 1 ]; then
  echo "== 预览 D1：迁移 + 导入全部历史数据（$DATA_DIR）"
  $W d1 migrations apply ai-daily-preview --remote -c "$CFG" --env preview
  node scripts/json2sql.js --all "$DATA_DIR"
  $W d1 execute ai-daily-preview --remote -c "$CFG" --env preview --file=sql/all.sql --yes
fi
echo "== 构建前端"
pnpm install --frozen-lockfile >/dev/null && pnpm --filter @ai-daily/web build
echo "== 部署预览 Worker（$(git rev-parse --short HEAD)）"
$W deploy -c "$CFG" --env preview --message "preview $(git rev-parse --short HEAD) $(git rev-parse --abbrev-ref HEAD)" | tee /tmp/cf-deploy-preview.log
URL=$(grep -oE 'https://[a-zA-Z0-9.-]+\.workers\.dev' /tmp/cf-deploy-preview.log | head -1)
[ -n "$URL" ] || { echo "未从输出中解析到预览地址"; exit 1; }
echo "== 冒烟 $URL"
for i in $(seq 1 12); do curl -fsS -m 10 "$URL/api/health" 2>/dev/null && break; sleep 5; done; echo
curl -fsS -o /dev/null -m 10 "$URL/" && curl -fsS -m 10 "$URL/api/days" | grep -q '"latest"' && echo "OK 预览地址: $URL"
