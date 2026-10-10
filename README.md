# AI 热点日报（ai-daily）

每天从 X（Twitter）公开数据汇总 AI 热点，中文呈现：X 原帖卡片 + AI 摘要，可回看历史、搜索、收藏、看趋势。

- 线上：https://ai-daily.qiao-ai-daily.workers.dev
- 公开仓库：欢迎查看；**请勿在 Issue/PR 中粘贴任何密钥**
- 技术：pnpm monorepo（TypeScript strict）——前端 Vite + React 19 + React Router + Tailwind CSS v4，后端 Hono（Cloudflare Workers）+ zod 校验，D1（SQLite）；前后端发布为同一个 Worker `ai-daily`（`/api/*` 走 Hono，其余为静态资源）

## 目录
```
apps/web/            前端：Vite + React + TS + Tailwind v4（构建产物 apps/web/dist = Worker 静态资源）
  src/components/    组件（StoryCard、Tweet、SummaryPanel、LeftNav …）
  src/views/ state/ lib/ api/ styles/   视图、URL 状态、纯函数、API 客户端、样式（styles/theme.css = 设计 token 入口）
apps/api/            后端：Hono on Cloudflare Workers（wrangler.jsonc 在这里）
  src/routes/        路由（只做 HTTP：参数校验 → 调 service → 输出）
  src/services/      业务逻辑（日报、搜索、趋势、收藏、导出）
  src/db/            SQL 与表行类型（表结构由 migrations/ 定义）
packages/shared/     前后端共用的 API 类型 + zod 参数 schema
migrations/          D1 表结构（不变）
scripts/             env.sh · daily.sh · deploy.sh · json2sql.js · check.sh · ci-local.sh · setup_labels.sh
tests/               黑盒测试：tests/api（真实 Worker + 本地 D1）、tests/unit（json2sql）、tests/ui-v2.js（无头 Chrome）
data/                日报 JSON 快照（X 公开数据，格式不变）
tools/               日报 JSON 模板
docs/                产品 / 设计 / 测试 / 部署文档与团队流程
```

## 快速开始
```bash
corepack enable                  # Node ≥ 22.12，pnpm 版本由 package.json 的 packageManager 决定
pnpm install
bash scripts/install-hooks.sh    # 启用 pre-commit/pre-push 钩子（自动跑本地 CI）
pnpm run ci                      # = bash scripts/ci-local.sh：lint → typecheck → vitest → 构建 → wrangler dry-run → 黑盒 API 测试 …
pnpm run ci:ui                   # 再加无头 UI 测试（前端/API 改动必跑）。注意 `pnpm ci` 是 pnpm 内置命令，要写 `pnpm run ci`
pnpm db:local && pnpm dev        # 本地 D1 + 构建前端 + wrangler dev → http://127.0.0.1:8787
pnpm dev:web                     # 可选：Vite 热更新 http://127.0.0.1:5173（/api 代理到 8787，需要 pnpm dev 同时运行）
node tests/ui-v2.js http://127.0.0.1:8787 /tmp/shot-
```
其他脚本：`pnpm lint` · `pnpm format` · `pnpm typecheck` · `pnpm test`（Vitest）· `pnpm test:api`（黑盒，需先 `pnpm build`）

## 每日更新 / 部署
```bash
bash scripts/daily.sh --dry-run 2026-10-10   # 只校验，不连 Cloudflare
bash scripts/daily.sh 2026-10-10             # 推送当天数据到 D1（无需重新部署）
bash scripts/deploy.sh                       # 构建前端 + 代码部署（需负责人批准；Worker 配置在 apps/api/wrangler.jsonc）
```
需要环境变量 `CLOUDFLARE_API_TOKEN`；日报 JSON 目录 `DATA_DIR` 默认 `/workspace/ai-digest/data`（不存在时用仓库 `data/`）。**不要提交任何密钥。**

## 文档
- 产品：[PRD](docs/product/PRD.md) · [数据采集](docs/product/data-pipeline.md) · [Roadmap](docs/product/roadmap.md)
- 设计：[UI 规范（v5）](docs/design/ui-spec.md)
- 测试：[测试计划](docs/test/test-plan.md)
- 部署：[Runbook](docs/deploy/runbook.md)
- 协作：[团队流程](docs/workflow.md)（角色、标签、分支、PR 规则、人工关卡）
