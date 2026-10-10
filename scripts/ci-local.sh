#!/usr/bin/env bash
# Local CI — the single entry point that every bot MUST run (and pass) before every commit/push.
# .github/workflows/ci.yml calls this same script, so local == CI by construction.
#
# Usage: bash scripts/ci-local.sh [--fast] [--ui [URL]] [--no-tests]
#   --fast       never run `npm ci` (pre-commit hook mode); fails if node_modules is missing
#   --ui [URL]   also run the headless UI test (tests/ui-v2.js). Without URL a local `wrangler dev` is started
#                on port ${CI_UI_PORT:-8788} with a seeded local D1. Needs Chrome (CHROME_PATH) + puppeteer-core.
#   --no-tests   skip unit/API tests (not allowed for PRs; for quick experiments only)
# Exit code: 0 = all steps passed, 1 = something failed. A paste-ready summary is printed at the end
# and saved to .ci-local/last-result.md (git-ignored).
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1
ROOT=$PWD
[ -d "$HOME/.local/node22/bin" ] && export PATH="$HOME/.local/node22/bin:$PATH"
export PATH="$PATH:$HOME/.local/bin"
export WRANGLER_SEND_METRICS=false PUPPETEER_SKIP_DOWNLOAD=true
unset CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID   # local CI never talks to Cloudflare

ARGS="$*"
FAST=0 UI=0 UI_URL="" TESTS=1
while [ $# -gt 0 ]; do
  case "$1" in
    --fast) FAST=1 ;;
    --ui) UI=1; if [ -n "${2:-}" ] && [[ "$2" != --* ]]; then UI_URL=$2; shift; fi ;;
    --no-tests) TESTS=0 ;;
    -h|--help) sed -n 2,12p "$0"; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac; shift
done

LOGDIR="$ROOT/.ci-local"; mkdir -p "$LOGDIR"
RESULTS=() FAILED=0 T0=$(date +%s)
step() {  # step <name> <command...>   — runs command, records PASS/FAIL + duration, keeps the log
  local name=$1; shift; local s e rc log="$LOGDIR/$(echo "$name" | tr -c 'A-Za-z0-9' '_').log"
  echo; echo "▶ $name"; s=$(date +%s)
  ( "$@" ) >"$log" 2>&1; rc=$?
  e=$(( $(date +%s) - s ))
  if [ $rc -eq 0 ]; then
    if grep -qE '^# (tests|pass) ' "$log"; then grep -E '^# (tests|pass|fail|skipped|todo) ' "$log" | tr '\n' ' ' | sed 's/^/  /'; echo
      RESULTS+=("| $name | ✅ PASS ($(grep -E '^# (pass|fail|todo) ' "$log" | sed 's/^# //' | tr '\n' ',' | sed 's/,$//; s/,/, /g')) | ${e}s |")
    else tail -n 3 "$log" | sed 's/^/  /'; RESULTS+=("| $name | ✅ PASS | ${e}s |"); fi
  else tail -n 40 "$log" | sed 's/^/  /'; RESULTS+=("| $name | ❌ FAIL (exit $rc) | ${e}s |"); FAILED=1; fi
}
skip() { echo; echo "▷ $1 — SKIPPED: $2"; RESULTS+=("| $1 | ⏭ skipped: $2 | – |"); }

# 1. dependencies (CI: npm ci)
deps_fresh() { [ -f node_modules/.package-lock.json ] && [ ! package-lock.json -nt node_modules/.package-lock.json ]; }
if deps_fresh; then skip "npm ci" "node_modules is up to date"
elif [ $FAST = 1 ]; then
  if [ -d node_modules ]; then skip "npm ci" "--fast (node_modules may be stale; run without --fast)"; else step "npm ci" false; echo "  node_modules missing: run bash scripts/ci-local.sh (without --fast)"; fi
else step "npm ci" npm ci --no-audit --no-fund; fi

# 2. syntax + data validation + static assets + wrangler deploy --dry-run
step "check.sh (syntax, data, assets, wrangler dry-run)" bash scripts/check.sh

# 3. daily.sh dry-run on the repo data snapshot
LATEST=$(ls data/*.json 2>/dev/null | sort | tail -1 | xargs -r basename -s .json)
if [ -n "$LATEST" ]; then step "daily.sh --dry-run $LATEST (DATA_DIR=data/)" env DATA_DIR="$ROOT/data" bash scripts/daily.sh --dry-run "$LATEST"
else skip "daily.sh --dry-run" "no data/*.json"; fi

# 4. secret scan
SECRET_RE='(CLOUDFLARE_API_TOKEN|api[_-]?token|api[_-]?key|secret|password)\s*[:=]\s*["'"'"']?[A-Za-z0-9_\-]{20,}|gh[opusr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY'
grep_scan() {  # tracked + untracked (non-ignored) files, like CI's git grep but including new files
  local files; files=$(git ls-files -co --exclude-standard | grep -v '^package-lock.json$' | while read -r f; do [ -f "$f" ] && echo "$f"; done)
  [ -z "$files" ] && return 0
  if echo "$files" | tr '\n' '\0' | xargs -0 grep -nIE "$SECRET_RE"; then echo "possible secret found (see above)"; return 1; fi
  echo "grep scan clean ($(echo "$files" | wc -l) files)"
}
if command -v gitleaks >/dev/null 2>&1; then
  gitleaks_scan() {
    gitleaks git --redact --no-banner . || return 1                       # full committed history
    gitleaks git --pre-commit --staged --redact --no-banner . || return 1 # staged changes (pre-commit)
    grep_scan                                                            # untracked files too
  }
  step "secret scan (gitleaks $(gitleaks version) + grep)" gitleaks_scan
else
  step "secret scan (grep; install gitleaks for a deeper scan)" grep_scan
fi

# 5. unit + API tests (node:test; real Worker via wrangler test harness + local D1, no Cloudflare)
if [ $TESTS = 0 ]; then skip "unit/API tests" "--no-tests"
elif [ -x tests/run.sh ] || [ -f tests/run.sh ]; then step "unit/API tests (tests/run.sh all)" env TEST_REPORTER=tap bash tests/run.sh all
else
  shopt -s nullglob; T=(tests/unit/*.test.mjs tests/api/*.test.mjs); shopt -u nullglob
  if [ ${#T[@]} -gt 0 ]; then step "unit/API tests (node --test, ${#T[@]} files)" node --no-warnings=ExperimentalWarning --test --test-reporter=tap "${T[@]}"
  else skip "unit/API tests" "no tests/unit or tests/api test files"; fi
fi

# 6. optional headless UI test
if [ $UI = 1 ]; then
  if [ -n "$UI_URL" ]; then step "UI test (tests/ui-v2.js @ $UI_URL)" node tests/ui-v2.js "$UI_URL" "$LOGDIR/ui-"
  else
    ui_local() {
      local port=${CI_UI_PORT:-8788} pid rc
      npx wrangler d1 migrations apply ai-daily --local >/dev/null && node scripts/json2sql.js --all data >/dev/null \
        && npx wrangler d1 execute ai-daily --local --file=sql/all.sql --yes >/dev/null || return 1
      npx wrangler dev --local --port "$port" >"$LOGDIR/wrangler-dev.log" 2>&1 & pid=$!
      for _ in $(seq 1 60); do curl -fsS "http://127.0.0.1:$port/api/health" >/dev/null 2>&1 && break; sleep 1; done
      node tests/ui-v2.js "http://127.0.0.1:$port" "$LOGDIR/ui-"; rc=$?
      kill "$pid" 2>/dev/null; pkill -f "wrangler dev --local --port $port" 2>/dev/null; wait "$pid" 2>/dev/null
      return $rc
    }
    step "UI test (tests/ui-v2.js @ local wrangler dev)" ui_local
  fi
else skip "UI test" "not requested (use --ui for frontend/API changes)"; fi

# summary
SHA=$(git rev-parse --short HEAD 2>/dev/null); BR=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
DIRTY=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
STATUS=$([ $FAILED = 0 ] && echo "✅ PASSED" || echo "❌ FAILED")
{
  echo "### Local CI result: $STATUS"
  echo "- command: \`bash scripts/ci-local.sh${ARGS:+ $ARGS}\`"
  echo "- branch \`$BR\` @ \`$SHA\` (+$DIRTY uncommitted/staged changes) · node $(node -v) · $(TZ=Asia/Shanghai date '+%Y-%m-%d %H:%M') (UTC+8) · $(( $(date +%s) - T0 ))s"
  echo
  echo "| step | result | time |"
  echo "|---|---|---|"
  printf '%s\n' "${RESULTS[@]}"
} > "$LOGDIR/last-result.md"
echo; echo "================ paste into the PR ================"; cat "$LOGDIR/last-result.md"; echo "===================================================="
echo "(saved to .ci-local/last-result.md; step logs in .ci-local/*.log)"
exit $FAILED
