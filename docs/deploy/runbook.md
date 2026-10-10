# 部署与每日运维 Runbook

## 基本信息
- 线上：https://ai-daily.qiao-ai-daily.workers.dev（`PUBLIC_URL.txt`）
- Cloudflare：Worker `ai-daily` + Static Assets（`public/`）+ D1 `ai-daily`（APAC），`wrangler.jsonc` 中的 `database_id` 可以提交（不是密钥）。
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

## 代码部署（需负责人批准，见 docs/workflow.md）
```bash
npm ci
npm run check                       # 或 bash scripts/deploy.sh --dry-run
bash scripts/deploy.sh              # 子域检查 → D1（必要时创建）→ 迁移 → 导入全部历史 → wrangler deploy → 验证 → 写 PUBLIC_URL.txt
node tests/ui-v2.js https://ai-daily.qiao-ai-daily.workers.dev /tmp/live-
```
部署后冒烟：
```bash
U=https://ai-daily.qiao-ai-daily.workers.dev
curl -s $U/api/health
curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'Origin: https://evil.example' -H 'Content-Type: application/json' -d '{"story_id":"x"}' $U/api/favorites   # 期望 403
curl -s -o /dev/null -w '%{http_code}\n' -X POST $U/api/ingest     # 期望 405
```
说明：`deploy.sh` 会重新导入 `DATA_DIR` 下的全部日报（幂等，收藏保留）。新 workers.dev 子域首次 TLS 可能需几分钟，脚本最多等 10 分钟。

## 数据库迁移
- 新增 `migrations/NNNN_描述.sql`（D1 不允许在文件中写 BEGIN/COMMIT），尽量向后兼容（先加列，再改代码）。
- `deploy.sh` 会执行 `wrangler d1 migrations apply ai-daily --remote`。
- 本地验证：`npx wrangler d1 migrations apply ai-daily --local`。

## 回滚
- **代码/前端**：Cloudflare 保留 Worker 版本（含静态资源）。
  ```bash
  npx wrangler deployments list            # 查看版本
  npx wrangler rollback [<version-id>]     # 回到上一个/指定版本
  ```
  或者 `git revert` 出问题的提交 → 重新 `bash scripts/deploy.sh`。
- **某天数据有误**：修正 JSON 后重跑 `bash scripts/daily.sh <date>`（整天替换）。删除某天：`npx wrangler d1 execute ai-daily --remote --command "DELETE FROM posts WHERE story_id IN (SELECT id FROM stories WHERE date='<date>'); DELETE FROM story_categories WHERE story_id IN (SELECT id FROM stories WHERE date='<date>'); DELETE FROM stories WHERE date='<date>'; DELETE FROM days WHERE date='<date>';"`（需负责人批准）。
- **D1 整库**：D1 Time Travel 可恢复到过去 30 天内任意时间点：`npx wrangler d1 time-travel info ai-daily`、`npx wrangler d1 time-travel restore ai-daily --timestamp <ISO 时间>`（会覆盖当前数据，必须负责人批准）。
- **迁移回滚**：D1 没有自动 down 迁移；写一个新的修正迁移，或用 Time Travel。

## 故障排查
| 现象 | 处理 |
|---|---|
| `wrangler` 报 Node 版本 | `source scripts/env.sh` 或安装 Node 22 |
| 401/403 来自 Cloudflare API | token 过期或权限不足（需 Workers Scripts Edit + D1 Edit） |
| 线上 TLS 握手失败 | 新子域证书签发中，等 1–10 分钟 |
| 页面“加载失败” | 看 `/api/health`；`npx wrangler tail` 查看 Worker 日志 |
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
