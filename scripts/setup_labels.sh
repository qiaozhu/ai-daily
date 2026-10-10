#!/usr/bin/env bash
# Create/update the workflow labels on the GitHub repo (idempotent). Needs an authenticated gh CLI.
# Usage: scripts/setup_labels.sh [owner/repo]   (default: the repo of the current directory)
set -euo pipefail
REPO_ARG=()
[ -n "${1:-}" ] && REPO_ARG=(--repo "$1")
label() { gh label create "$1" --color "$2" --description "$3" --force "${REPO_ARG[@]}"; }
# type
label "type:feature"          "1d76db" "新功能 / 改进"
label "type:bug"              "d73a4a" "缺陷"
label "type:chore"            "c5def5" "杂项：依赖、重构、文档、运维"
# status (exactly one at a time)
label "status:needs-prd"      "fbca04" "等待产品写 PRD / 需求澄清"
label "status:needs-design"   "f9d0c4" "PRD 已签字，等待设计"
label "status:ready-for-dev"  "0e8a16" "设计已选定，可以开发"
label "status:in-review"      "5319e7" "PR 已提交，测试/评审中"
label "status:ready-to-deploy" "006b75" "已合并，等待负责人批准部署"
label "status:done"           "cccccc" "已上线并验证"
# role (who owns the next step)
label "role:product"          "bfd4f2" "产品 bot"
label "role:design"           "d4c5f9" "设计 bot"
label "role:dev"              "c2e0c6" "开发 bot"
label "role:test"             "fef2c0" "测试 bot"
label "role:deploy"           "bfdadc" "部署 bot"
label "role:coordinator"      "ededed" "协调 bot"
# human gates
label "needs-owner"           "b60205" "需要负责人（qiao）决定或批准"
echo "labels OK"
