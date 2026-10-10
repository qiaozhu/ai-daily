#!/usr/bin/env bash
# Daily data update: push one day's JSON into remote D1 (no redeploy needed; the frontend reads /api).
# Usage: scripts/daily.sh [--dry-run] [YYYY-MM-DD]   (default date: today in UTC+8)
#   --dry-run  validate the JSON and generate sql/<date>.sql, print the wrangler command, touch nothing remote.
# Env: CLOUDFLARE_API_TOKEN (required unless --dry-run), DATA_DIR (optional, see scripts/env.sh)
set -euo pipefail
if [ "${1:-}" = "--dry-run" ]; then export DRY_RUN=1; shift; fi
# shellcheck source=scripts/env.sh
source "$(dirname "${BASH_SOURCE[0]}")/env.sh"
DATE=${1:-$(TZ=Asia/Shanghai date +%F)}
[[ "$DATE" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || { echo "日期格式应为 YYYY-MM-DD: $DATE"; exit 2; }
F="$DATA_DIR/$DATE.json"
[ -f "$F" ] || { echo "缺少 $F（DATA_DIR=$DATA_DIR）"; exit 1; }
node scripts/json2sql.js "$F"
CMD=(npx wrangler d1 execute ai-daily --remote --file="sql/$DATE.sql" --yes)
if [ "${DRY_RUN:-0}" = 1 ]; then echo "[dry-run] REPO_DIR=$REPO_DIR DATA_DIR=$DATA_DIR"; echo "[dry-run] 将执行: ${CMD[*]}"; exit 0; fi
: "${CLOUDFLARE_API_TOKEN:?需要 CLOUDFLARE_API_TOKEN}"; : "${CLOUDFLARE_ACCOUNT_ID:?无法获取 CLOUDFLARE_ACCOUNT_ID}"
"${CMD[@]}"
URL=$(cat PUBLIC_URL.txt 2>/dev/null || true)
if [ -n "$URL" ]; then
  curl -fsS -m 15 "$URL/api/days/$DATE" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const d=JSON.parse(s);console.log('线上已更新',d.date,d.stories.length,'条')})"
  echo "公网地址: $URL"
fi
