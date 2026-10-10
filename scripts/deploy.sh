#!/usr/bin/env bash
# First-time (and repeatable) deploy: workers.dev subdomain, D1 create/migrate, import all days, deploy Worker, verify.
# Usage: scripts/deploy.sh [--dry-run]
# Env: CLOUDFLARE_API_TOKEN (required unless --dry-run; never commit it); CLOUDFLARE_ACCOUNT_ID is auto-derived.
# --dry-run: validate data + bundle the Worker locally (wrangler deploy --dry-run), no Cloudflare calls.
set -euo pipefail
if [ "${1:-}" = "--dry-run" ]; then export DRY_RUN=1; shift; fi
# shellcheck source=scripts/env.sh
source "$(dirname "${BASH_SOURCE[0]}")/env.sh"
# monorepo: the Worker config lives in apps/api; the frontend (apps/web) must be built before deploy (static assets)
CFG=apps/api/wrangler.jsonc
build_web() { pnpm install --frozen-lockfile >/dev/null && pnpm --filter @ai-daily/web build; }
if [ "${DRY_RUN:-0}" = 1 ]; then
  node scripts/json2sql.js --all "$DATA_DIR"
  build_web
  npx wrangler deploy -c "$CFG" --dry-run --outdir .wrangler/dry-run
  echo "[dry-run] OK：未连接 Cloudflare"; exit 0
fi
: "${CLOUDFLARE_API_TOKEN:?需要 CLOUDFLARE_API_TOKEN}"; : "${CLOUDFLARE_ACCOUNT_ID:?无法获取 CLOUDFLARE_ACCOUNT_ID}"
W="npx wrangler"
echo "== 1. 验证令牌 (account $CLOUDFLARE_ACCOUNT_ID)"; $W whoami || echo "(whoami 失败可忽略：令牌可能没有 User Details:Read)"
echo "== 1b. workers.dev 子域"
SUB=$(curl -fsS -m 20 -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/subdomain" 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{process.stdout.write(JSON.parse(s).result.subdomain||'')}catch(e){}})")
if [ -z "$SUB" ]; then
  SUB=${WORKERS_SUBDOMAIN:-qiao-ai-daily}
  curl -fsS -m 20 -X PUT -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H 'Content-Type: application/json' -d "{\"subdomain\":\"$SUB\"}" "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/subdomain" >/dev/null || { echo "创建 workers.dev 子域失败"; exit 1; }
fi
echo "subdomain=$SUB.workers.dev"
echo "== 2. D1 数据库"
DBID=$($W d1 list --json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const a=JSON.parse(s);const d=a.find(x=>x.name==='ai-daily');process.stdout.write(d?d.uuid:'')})")
if [ -z "$DBID" ]; then
  $W d1 create ai-daily --location apac >/dev/null
  DBID=$($W d1 list --json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const d=JSON.parse(s).find(x=>x.name==='ai-daily');process.stdout.write(d?d.uuid:'')})")
fi
[ -n "$DBID" ] || { echo "无法获取 D1 database_id"; exit 1; }
echo "database_id=$DBID"
# only rewrite the id that follows "database_name": "ai-daily" (production), never env.preview's entry
node -e "const fs=require('fs');const p='$CFG';const s=fs.readFileSync(p,'utf8');const re=/(\"database_name\": \"ai-daily\",[^}]*?\"database_id\": \")[^\"]*(\")/;if(!re.test(s)){console.error('wrangler.jsonc 里找不到生产 D1 配置');process.exit(1)}fs.writeFileSync(p,s.replace(re,'\$1$DBID\$2'))"
echo "== 3. 迁移"; $W d1 migrations apply ai-daily --remote -c "$CFG"
echo "== 4. 导入全部历史数据"; node scripts/json2sql.js --all "$DATA_DIR"; $W d1 execute ai-daily --remote -c "$CFG" --file=sql/all.sql --yes
echo "== 5. 构建前端 + 部署 Worker"; build_web; $W deploy -c "$CFG" | tee /tmp/cf-deploy.log
URL=$(grep -oE 'https://[a-zA-Z0-9.-]+\.workers\.dev' /tmp/cf-deploy.log | head -1)
[ -n "$URL" ] || { echo "未从输出中解析到 workers.dev 地址（可能账号还没有 workers.dev 子域，见 README）"; exit 1; }
echo "== 6. 验证 $URL"
for i in $(seq 1 60); do curl -fsS -m 10 "$URL/api/health" 2>/dev/null && break; sleep 10; done; echo  # new workers.dev subdomains can take a few minutes for TLS
curl -fsS -m 10 "$URL/api/days" | grep -q '"latest"' && curl -fsS -o /dev/null -m 10 "$URL/" && echo "$URL" > PUBLIC_URL.txt && echo "OK 公网地址: $URL"
