# AI 热点日报（ai-daily）

每天从 X（Twitter）公开数据汇总 AI 热点，中文呈现：X 原帖卡片 + AI 摘要，可回看历史、搜索、收藏、看趋势。

- 线上：https://ai-daily.qiao-ai-daily.workers.dev
- 公开仓库：欢迎查看；**请勿在 Issue/PR 中粘贴任何密钥**
- 技术：Cloudflare Workers（API）+ Static Assets（前端）+ D1（SQLite），无框架、无构建步骤

## 目录
```
src/worker.js        API（/api/days、/api/stories、/api/trends、/api/favorites、/api/export …）
public/              前端（index.html / app.js / style.css / theme.js / _headers）
migrations/          D1 表结构
scripts/             env.sh · daily.sh · deploy.sh · json2sql.js · check.sh · setup_labels.sh
tests/ui-v2.js       无头 Chrome 端到端测试（桌面 1440 / 手机 390，浅色 / 深色）
data/                日报 JSON 快照（X 公开数据）
tools/               日报 JSON 模板
docs/                产品 / 设计 / 测试 / 部署文档与团队流程
```

## 快速开始
```bash
npm install                      # Node ≥ 22
bash scripts/install-hooks.sh    # 启用 pre-commit/pre-push 钩子（自动跑本地 CI）
bash scripts/ci-local.sh         # 本地 CI（提交前必跑，与 GitHub CI 一致；前端/API 改动加 --ui）
npm run db:local && npm run dev  # 本地 http://127.0.0.1:8787
node tests/ui-v2.js http://127.0.0.1:8787 /tmp/shot-
```

## 每日更新 / 部署
```bash
bash scripts/daily.sh --dry-run 2026-10-10   # 只校验，不连 Cloudflare
bash scripts/daily.sh 2026-10-10             # 推送当天数据到 D1（无需重新部署）
bash scripts/deploy.sh                       # 代码部署（需负责人批准）
```
需要环境变量 `CLOUDFLARE_API_TOKEN`；日报 JSON 目录 `DATA_DIR` 默认 `/workspace/ai-digest/data`（不存在时用仓库 `data/`）。**不要提交任何密钥。**

## 文档
- 产品：[PRD](docs/product/PRD.md) · [数据采集](docs/product/data-pipeline.md) · [Roadmap](docs/product/roadmap.md)
- 设计：[UI 规范（v5）](docs/design/ui-spec.md)
- 测试：[测试计划](docs/test/test-plan.md)
- 部署：[Runbook](docs/deploy/runbook.md)
- 协作：[团队流程](docs/workflow.md)（角色、标签、分支、PR 规则、人工关卡）
