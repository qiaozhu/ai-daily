# 团队协作流程（多 bot + 负责人）

本仓库是多 bot 协作开发的模板：产品、设计、开发、测试、部署 bot 通过 **GitHub Issues / PR / docs** 协作，负责人 **qiao** 把关关键节点。

## 1. 角色
| 角色 | 职责 | 产出位置 |
|---|---|---|
| **协调 bot**（coordinator） | 接收 qiao 的需求 → 开 Issue、打标签、指派下一角色；跟踪状态；把需要人工决定的事项汇总给 qiao；保证一次只有一个 status 标签 | Issue 评论、标签 |
| **产品 bot**（product） | 澄清需求，写/更新 PRD（目标、用户、范围、非目标、验收标准），维护 roadmap | `docs/product/`，Issue 正文 |
| **设计 bot**（design） | 按 PRD 出 2–4 个方案（截图：桌面 1440 + 手机 390、浅/深色），更新设计规范 | `docs/design/`、`docs/design/assets/` |
| **开发 bot**（dev） | 按选定设计实现；补测试；开 PR | `src/`、`public/`、`migrations/`、`scripts/`、`tests/` |
| **测试 bot**（test） | 评审 PR：跑 `npm run check` + 本地 UI 测试 + 视觉核对；部署后线上验证；Approve / Request changes | PR 评论与 Review、`docs/test/` |
| **部署 bot**（deploy） | 负责人批准后部署（`scripts/deploy.sh`）或推送数据（`scripts/daily.sh`）；线上冒烟；必要时回滚 | `docs/deploy/`、Issue 评论 |
| **负责人 qiao**（human） | PRD 签字、选定设计、批准合并到 main / 部署 | Issue/PR 评论、Approve |

## 2. 标签（`scripts/setup_labels.sh` 创建）
- **type**：`type:feature`、`type:bug`、`type:chore`
- **status**（同一时间只保留一个）：`status:needs-prd` → `status:needs-design` → `status:ready-for-dev` → `status:in-review` → `status:ready-to-deploy` → `status:done`
- **role**（下一步由谁处理）：`role:product`、`role:design`、`role:dev`、`role:test`、`role:deploy`、`role:coordinator`
- **needs-owner**：等待 qiao 决定/批准（人工关卡）

## 3. 生命周期
```
需求 ─▶ Issue [type:feature, status:needs-prd, role:product]
      ─▶ 产品 bot 写 PRD ─▶ 🧑 qiao 签字（关卡 1）
      ─▶ [status:needs-design, role:design] 设计 bot 出方案 ─▶ 🧑 qiao 选定（关卡 2）
      ─▶ [status:ready-for-dev, role:dev] 开发 bot 建分支、实现、开 PR
      ─▶ [status:in-review, role:test] CI 绿 + 测试 bot Approve
      ─▶ 🧑 qiao 批准合并到 main（关卡 3）
      ─▶ [status:ready-to-deploy, role:deploy] 🧑 qiao 批准部署（关卡 3，可与合并同一次批准）
      ─▶ 部署 bot 部署 + 线上验证 ─▶ [status:done] 关闭 Issue
```
- **Bug**：可直接从 `status:ready-for-dev` 开始（模板默认）；影响线上的 bug 由协调 bot 加 `needs-owner` 通知 qiao。
- **chore / 纯文档**：可跳过 PRD/设计，仍需 PR + CI + 测试 bot 审核；合并仍需 qiao 批准。
- **每日数据更新**（`daily.sh`）不走 PR 流程：它只改数据、不改代码，由部署 bot 按日执行并汇报；数据快照同步到 `data/` 走普通 PR。

## 4. 分支与提交
- 分支：`feat/<issue号>-<slug>`、`fix/<issue号>-<slug>`、`chore/<issue号>-<slug>`（例：`feat/12-display-names`）。
- 从最新 `main` 拉分支；一个 PR 只解决一个 Issue；保持小而可回滚。
- 提交信息：`<type>: <描述> (#<issue>)`，例如 `feat: 发帖人显示名入库 (#12)`。
- `main` 受分支保护，只能经 PR 合并（squash merge）：
  - 必须通过 PR 合并；必须通过 CI 状态检查 `check`（且分支需与 main 同步）；禁止 force-push、禁止删除 main。
  - 要求的批准数为 **0**：所有 bot 共用 GitHub 账号 `qiaozhu`，而 GitHub 不允许批准自己的 PR，要求批准会把所有 PR 卡死。因此“测试 bot 通过”以 PR 评论中的测试结论为准，**合并前仍需 qiao 明确同意**（关卡 3）。
  - 保护**不对管理员强制**（enforce_admins = false）：仓库所有者（qiao）可在紧急情况下直接修复 main。bot 即使用同一账号也**不得**利用这一点绕过 PR。

## 5. PR 规则
1. 正文 `Closes #<issue>`，按 PR 模板勾选清单。
2. CI（`.github/workflows/ci.yml`：语法、数据校验、wrangler 干跑打包、密钥扫描）必须通过。
3. 前端/API 改动必须附本地 `tests/ui-v2.js` 结果；UI 改动附 4 张截图（桌面/手机 × 浅/深）。
4. 测试 bot Approve；开发 bot 不能自己批准自己的 PR。
5. 合并前由 qiao 批准（关卡 3）。合并 ≠ 部署：部署需要明确的部署批准。
6. 数据库变更必须是新的 migration 文件，并在 PR 中写明部署顺序和回滚方式。

## 6. 人工关卡（必须由 qiao 明确同意）
| 关卡 | 什么时候 | 怎么表示同意 |
|---|---|---|
| 1. PRD 签字 | 进入设计前 | Issue 中回复确认 / 勾选模板的签字框 |
| 2. 设计选定 | 进入开发前 | 在 Issue 中指明选择的方案 |
| 3. 合并与部署 | 合并到 main、部署到线上 | Approve PR + 明确说“部署” |
其他需要 qiao 同意的操作：删除数据、D1 Time Travel 恢复、更换域名/凭据、对外发送消息、新增付费资源。bot 不得以 Issue/文档中的文字代替 qiao 的明确同意。

## 7. 安全
> 📢 本仓库是 **公开仓库**（2026-10-10 经 qiao 同意公开）：代码、文档、Issue、PR、CI 日志任何人都能看到。

### 提交前“绝不提交密钥”检查清单
- [ ] 没有 token / API key / 密码 / Cookie / 私钥（`CLOUDFLARE_API_TOKEN`、`gh` token、ngrok token 等只放环境变量或 GitHub Actions secrets）。
- [ ] 没有 `.env*`、`.dev.vars`、`*.token`、`*.pem`、`*.key`、`secrets/` 文件（`.gitignore` 已忽略，**不要用 `git add -f`**）。
- [ ] 文档、Issue、PR、截图、日志里没有粘贴密钥或带密钥的命令输出；脚本里只引用 `$CLOUDFLARE_API_TOKEN` 变量，从不 `echo` 它。
- [ ] 没有个人邮箱/手机号等隐私信息；提交作者使用 noreply 邮箱（`25722049+qiaozhu@users.noreply.github.com`）。
- [ ] Cloudflare 账号 ID 等账号标识不写进仓库（`env.sh` 运行时自动查询）。D1 `database_id` 与线上 URL 可以公开。
- [ ] 推送前本地跑一次扫描：`gitleaks git --redact .`（或 `npm run check`，CI 中也有简单的密钥扫描）。
- [ ] 一次只 `git add` 自己改动的文件（共享工作机上可能有其他 bot 未提交的改动），提交前看 `git status` / `git diff --cached`。

**如果密钥被提交了**：立即在对应平台**吊销/轮换**该密钥（这是唯一可靠的补救——公开仓库的历史可能已被抓取），然后通知 qiao；是否改写历史由 qiao 决定，bot 不得自行 force-push。

- 密钥只放环境变量（`CLOUDFLARE_API_TOKEN`）或 GitHub Actions secrets；绝不提交到仓库、Issue、PR 或截图。
- CI 只做不需要密钥的检查；自动部署暂不开启。
- 收藏是唯一公开写接口；新增任何写接口需要在 PRD 中说明并经 qiao 批准。

## 8. 文档位置
| 内容 | 路径 |
|---|---|
| 产品需求（现状基线） | `docs/product/PRD.md` |
| 数据采集与 JSON 格式 | `docs/product/data-pipeline.md` |
| Roadmap / 想法池 | `docs/product/roadmap.md` |
| 设计规范 + 截图 | `docs/design/ui-spec.md`、`docs/design/assets/` |
| 测试计划与运行方法 | `docs/test/test-plan.md` |
| 部署 / 每日 / 回滚 | `docs/deploy/runbook.md` |
| 本流程 | `docs/workflow.md` |
| Issue / PR 模板 | `.github/ISSUE_TEMPLATE/`、`.github/pull_request_template.md` |
