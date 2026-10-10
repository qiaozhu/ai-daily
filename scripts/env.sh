# shellcheck shell=bash
# Source me from any directory:  source scripts/env.sh
# Sets REPO_DIR (this repo), DATA_DIR (day JSON dir), puts Node >=22 on PATH (wrangler needs it), cd's into the repo.
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export REPO_DIR
# DATA_DIR: where the daily pipeline writes YYYY-MM-DD.json. Override with DATA_DIR=...;
# default is the bot box's collection dir, falling back to the repo's own data/ snapshot.
if [ -z "${DATA_DIR:-}" ]; then
  if [ -d /workspace/ai-digest/data ]; then DATA_DIR=/workspace/ai-digest/data; else DATA_DIR="$REPO_DIR/data"; fi
fi
export DATA_DIR
[ -d "$HOME/.local/node22/bin" ] && export PATH="$HOME/.local/node22/bin:$PATH"
export WRANGLER_SEND_METRICS=false
cd "$REPO_DIR" || return 1
# Derive CLOUDFLARE_ACCOUNT_ID from the token if not set (first account the token can see). Skipped in dry runs.
# The token is only read from the environment — never write it to a file in this repo.
if [ "${DRY_RUN:-0}" != 1 ] && [ -n "${CLOUDFLARE_API_TOKEN:-}" ] && [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then
  CLOUDFLARE_ACCOUNT_ID=$(curl -fsS -m 20 -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" https://api.cloudflare.com/client/v4/accounts \
    | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{process.stdout.write(JSON.parse(s).result[0].id)}catch(e){}})")
  export CLOUDFLARE_ACCOUNT_ID
fi
