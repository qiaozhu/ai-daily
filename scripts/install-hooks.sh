#!/usr/bin/env bash
# Point git at the tracked hooks in .githooks/ (pre-commit + pre-push run scripts/ci-local.sh).
# Run once per clone/worktree:  bash scripts/install-hooks.sh
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
chmod +x .githooks/* scripts/ci-local.sh
git config core.hooksPath .githooks
echo "core.hooksPath = $(git config core.hooksPath)  (hooks: $(ls .githooks | tr '\n' ' '))"
