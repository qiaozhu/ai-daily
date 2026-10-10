# 部署与每日运维 Runbook

## 基本信息
- 线上：https://ai-daily.qiao-ai-daily.workers.dev（`PUBLIC_URL.txt`）
- Cloudflare：Worker `ai-daily`（Hono，`apps/api`）+ Static Assets（`apps/web` 打包产物 `apps/web/dist`）+ D1 `ai-daily`（APAC）。配置文件在 **`apps/api/wrangler.jsonc`**（根目录没有配置），其中的 `database_id` 可以提交（不是密钥）。
- 预览：Worker `ai-daily-preview` + 独立 D1 `ai-daily-preview`，即 `wrangler.jsonc` 里的 `env.preview`，地址 https://ai-daily-preview.qiao-ai-daily.workers.dev 。
- ⚠️ 除了按数据库名直接操作 D1 的命令，所有 `wrangler` 命令都要加 **`-c apps/api/wrangler.jsonc`**（下文统一记作 `-c $CFG`，`CFG=apps/api/wrangler.jsonc`）。
- 凭据：只用环境变量 **`CLOUDFLARE_API_TOKEN`**（“Edit Cloudflare Workers” 模板 + Account → D1 → Edit）。`CLOUDFLARE_ACCOUNT_ID` 由 `scripts/env.sh` 自动查询。
- 🔒 **永远不要提交密钥**：不写进代码、文档、`.env`、截图或日志；不要 `echo` token。`.gitignore` 已忽略 `.env*`、`*.token`、`.dev.vars`、`secrets/`。不要运行 `wrangler login`。
- Node ≥22（wrangler 4 需要）；本机 bot 环境在 `~/.local/node22`，`env.sh` 会自动加入 PATH。

## 每日数据更新（不需要重新部署）
```bash
# 1. 采集并写好 $DATA_DIR/YYYY-MM-DD.json（默认 /workspace/ai-digest/data，可用 DATA_DIR=... 覆盖）
bash scripts/daily.sh --dry-run YYYY-MM-DD   # 校验 + 生成 sql/YYYY-MM-DD.sql，不连 Cloudflare
bash scripts/daily.sh YYYY-MM-DD             # 写入远程 D1，并请求线上 /api/days/<date> 确认
```
- 幂等：只删除并重写该天的数据，不影响其他天和收藏（收藏按稳定的 story id 保存）。
- 校验失败（缺字段、非 x.com 链接、日期与文件名不符）时不会写入。
- 建议随后把 JSON 通过 PR 同步到仓库 `data/`。

## 预览环境（任何 bot 都可以发，不需要批准）
每个 PR 合并前先发到预览地址验收，生产完全不受影响：
```bash
source scripts/env.sh
pnpm deploy:preview                     # = bash scripts/deploy-preview.sh：构建前端 → wrangler deploy --env preview → 冒烟
bash scripts/deploy-preview.sh --sync-data   # 需要时：预览 D1 迁移 + 重新导入 $DATA_DIR 下全部日报（幂等）
node tests/ui-v2.js https://ai-daily-preview.qiao-ai-daily.workers.dev /tmp/preview-   # 无头 UI 测试（会写收藏，只对预览跑）
```
- 预览只有一个地址，最后一次部署的分支生效；发之前在群里说一声，避免互相覆盖。
- 预览 D1 的数据来自本机的日报 JSON（`$DATA_DIR`，和生产每天导入的是同一批文件），不是从生产库复制；不含线上收藏。需要和生产完全一致时，用 `wrangler d1 export ai-daily --remote` 导出后手动导入。

## 分享卡预生成（每天数据更新之后）
```bash
source scripts/env.sh
node scripts/prerender-cards.mjs YYYY-MM-DD               # 渲染当天日报卡 + 每条话题卡（og 1200×630 / save 1080×1440）→ 写入生产 KV（binding CARDS）
node scripts/prerender-cards.mjs YYYY-MM-DD --env preview # 写入预览 KV
node scripts/prerender-cards.mjs YYYY-MM-DD --dry-run     # 只渲染到 .cards/YYYY-MM-DD/，不连 Cloudflare
```
- 读取 `$DATA_DIR/YYYY-MM-DD.json`（和 `daily.sh` 导入的是同一个文件），`daily.sh` 本身不动；由协调 bot 接在每日更新之后执行。
- KV 命名空间：生产 `ai-daily-cards`，预览 `ai-daily-cards-preview`。key 形如 `card/day/<date>/og.png`、`card/story/<story id>/save.png`。
- 卡片 180 天后自动过期（只删卡片，不删任何日报数据）；需要时重跑脚本即可重新生成。重复执行是幂等的（同名 key 覆盖）。
- 渲染函数来自 `packages/share-card`（`renderCard`），该包上线前脚本用纯色占位 PNG 跑通流程。
- 免费额度：每天约 26 次 KV 写入（上限 1000），约 2–3 MB。

## 生产发布（需负责人批准，见 docs/workflow.md）
发布清单，按顺序执行：
```bash
source scripts/env.sh && CFG=apps/api/wrangler.jsonc
git checkout --detach origin/main && pnpm install --frozen-lockfile
bash scripts/ci-local.sh                                   # 1. 合并后的 main 本地 CI 必须全绿
npx wrangler deployments list -c $CFG | tail -8            # 2. 记下当前线上版本 ID（回滚用）
npx wrangler d1 export ai-daily --remote -c $CFG --output /workspace/backups/ai-daily/prod-$(date +%Y%m%d-%H%M).sql   # 3. 备份 D1
npx wrangler d1 migrations list ai-daily --remote -c $CFG  # 4. 确认待执行的迁移（有的话先 apply）
pnpm build && npx wrangler deploy -c $CFG --message "<sha> <说明>"   # 5. 部署，记下新版本 ID
```
6. 冒烟（见下）+ 线上截图（桌面/手机 × 浅/深），把地址、前后版本 ID、备份路径报给协调 bot。
7. 有问题立即回滚：`npx wrangler rollback <上一个版本 ID> -c $CFG`。

首次部署或重建环境用 `bash scripts/deploy.sh`（子域检查 → D1（必要时创建）→ 迁移 → 导入全部历史 → 构建前端 → wrangler deploy → 验证 → 写 PUBLIC_URL.txt）。
⚠️ 不要对生产跑 `tests/ui-v2.js`：其中的收藏测试会写 `/api/favorites`。生产只做只读冒烟。

部署后冒烟（只读）：
```bash
U=https://ai-daily.qiao-ai-daily.workers.dev
curl -s $U/api/health                                              # ok:true，latest 是最新一天
for p in / /search?q=openai /api/days /api/nope /favicon.ico; do echo "$(curl -s -o /dev/null -w '%{http_code}' $U$p) $p"; done   # 期望 200 200 200 404 204
curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'Origin: https://evil.example' -H 'Content-Type: application/json' -d '{"story_id":"x"}' $U/api/favorites   # 期望 403（被拒绝，不写入）
curl -s -o /dev/null -w '%{http_code}\n' -X POST $U/api/ingest     # 期望 405
```
说明：`deploy.sh` 会重新导入 `DATA_DIR` 下的全部日报（幂等，收藏保留）。新 workers.dev 子域首次 TLS 可能需几分钟，脚本最多等 10 分钟。

## 数据库迁移
- 新增 `migrations/NNNN_描述.sql`（D1 不允许在文件中写 BEGIN/COMMIT），尽量向后兼容（先加列，再改代码）。
- `deploy.sh` 会执行 `wrangler d1 migrations apply ai-daily --remote -c $CFG`。
- 本地验证：`npx wrangler d1 migrations apply ai-daily --local -c $CFG`；预览：`npx wrangler d1 migrations apply ai-daily-preview --remote -c $CFG --env preview`。
- 有迁移的发布：先在预览环境 apply 并验收，生产发布前先备份 D1 再 apply。

## 回滚
- **代码/前端**：Cloudflare 保留 Worker 版本（含静态资源）。
  ```bash
  npx wrangler deployments list -c $CFG              # 查看版本
  npx wrangler rollback [<version-id>] -c $CFG       # 回到上一个/指定版本
  ```
  或者 `git revert` 出问题的提交 → 重新 `bash scripts/deploy.sh`。
- **某天数据有误**：修正 JSON 后重跑 `bash scripts/daily.sh <date>`（整天替换）。删除某天：`npx wrangler d1 execute ai-daily --remote --command "DELETE FROM posts WHERE story_id IN (SELECT id FROM stories WHERE date='<date>'); DELETE FROM story_categories WHERE story_id IN (SELECT id FROM stories WHERE date='<date>'); DELETE FROM stories WHERE date='<date>'; DELETE FROM days WHERE date='<date>';"`（需负责人批准）。
- **D1 备份文件**：每次生产发布前的导出在 `/workspace/backups/ai-daily/`（共享电脑，不进仓库）。
- **D1 整库**：D1 Time Travel 可恢复到过去 30 天内任意时间点：`npx wrangler d1 time-travel info ai-daily`、`npx wrangler d1 time-travel restore ai-daily --timestamp <ISO 时间>`（会覆盖当前数据，必须负责人批准）。
- **迁移回滚**：D1 没有自动 down 迁移；写一个新的修正迁移，或用 Time Travel。

## 故障排查
| 现象 | 处理 |
|---|---|
| `wrangler` 报 Node 版本 | `source scripts/env.sh` 或安装 Node 22 |
| 401/403 来自 Cloudflare API | token 过期或权限不足（需 Workers Scripts Edit + D1 Edit） |
| 线上 TLS 握手失败 | 新子域证书签发中，等 1–10 分钟 |
| 页面“加载失败” | 看 `/api/health`；`npx wrangler tail -c $CFG` 查看 Worker 日志 |
| `wrangler` 找不到 Worker 或用错配置 | 忘了加 `-c apps/api/wrangler.jsonc`（根目录没有配置文件） |
| 收藏 429 | 每 IP 每分钟 30 次写入限制 |

## 仓库状态与分支保护
- 仓库：https://github.com/qiaozhu/ai-daily —— **公开**（2026-10-10 起）。任何人可见代码、文档与 CI 日志，**绝不提交密钥**（清单见 `docs/workflow.md` §7）。
- 部署所需的 `CLOUDFLARE_API_TOKEN` 不放进仓库，也暂不放进 GitHub Actions secrets（CI 不做部署）。如以后开启自动部署，只能用 Actions secrets，并限定在 `main` 的受保护环境中。
- `main` 分支保护（当前设置）：

| 设置 | 值 |
|---|---|
| 合并前必须走 PR | 是（要求批准数 0：bot 共用账号，GitHub 不允许自批） |
| 必须通过的状态检查 | **暂时无**（2026-10-10 移除：Actions 因计费锁定无法运行）。以本地 CI `bash scripts/ci-local.sh` + 测试 bot 结论为合并关卡；Actions 恢复后重新要求 `check` |
| 禁止 force-push / 删除 | 是 / 是 |
| 对管理员强制 | **否**：仓库所有者可紧急直接修复 main；bot 不得借此绕过 PR |

查看 / 重新应用（当前设置；Actions 恢复后把 `required_status_checks` 改为 `{"strict":true,"contexts":["check"]}`）：
```bash
gh api repos/qiaozhu/ai-daily/branches/main/protection
gh api -X PUT repos/qiaozhu/ai-daily/branches/main/protection --input - <<'JSON'
{"required_status_checks":null,"enforce_admins":false,
 "required_pull_request_reviews":{"required_approving_review_count":0,"dismiss_stale_reviews":false},
 "restrictions":null,"allow_force_pushes":false,"allow_deletions":false}
JSON
```

## 密钥泄露应急
1. 立即在 Cloudflare / GitHub 等平台吊销并重新生成该密钥（公开仓库的历史可能已被抓取，删提交不够）。
2. 更新运行环境中的环境变量，验证 `scripts/daily.sh --dry-run` 与线上 `/api/health`。
3. 通知 qiao；是否改写 Git 历史由 qiao 决定（需要临时解除保护并 force-push，bot 不得自行操作）。
