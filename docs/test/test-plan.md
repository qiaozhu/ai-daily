# 测试计划

## 1. 层级
| 层 | 内容 | 何时跑 | 命令 |
|---|---|---|---|
| 静态检查 | Worker/前端/脚本语法、`data/` JSON 校验、静态资源齐全、无内联脚本、`wrangler deploy --dry-run` 打包 | 每个 PR（CI 自动） | `npm run check` |
| daily 干跑 | 校验当天 JSON → 生成 SQL，打印 wrangler 命令，不连 Cloudflare | CI + 每日推送前 | `bash scripts/daily.sh --dry-run YYYY-MM-DD` |
| UI 端到端 | 无头 Chrome，桌面 1440 + 手机 390，浅色 + 深色（见下） | 前端/API 改动的 PR（本地）、每次部署后（线上） | `node tests/ui-v2.js <URL> [截图前缀]` |
| API 冒烟 | `/api/health`、`/api/days`、跨站 POST 收藏应 403、`POST /api/ingest` 应 405 | 每次部署后 | 见 docs/deploy/runbook.md |

## 2. 运行 UI 测试（tests/ui-v2.js）
依赖：Node ≥22、`npm install`（含 puppeteer-core）、本机 Chrome（默认 `/usr/bin/google-chrome`，可用 `CHROME_PATH` 覆盖）。

```bash
npm install
npm run db:local          # 本地 D1：建表 + 导入数据（默认 DATA_DIR，见 scripts/env.sh）
npm run dev &             # wrangler dev --local --port 8787
node tests/ui-v2.js http://127.0.0.1:8787 /tmp/shot-     # 末行 ALL PASS 即通过
# 线上验证（部署后）：
node tests/ui-v2.js https://ai-daily.qiao-ai-daily.workers.dev /tmp/live-
```
截图输出：`<前缀>light-desktop.png`、`dark-desktop.png`、`search-desktop.png`、`light-mobile.png`、`dark-mobile.png`。
退出码：全部通过 0，否则 1（逐项打印 PASS/FAIL）。

⚠️ 收藏用例会在目标站点**加一条收藏再删掉**（结束后恢复原状态，并断言收藏数复原）。对线上运行前确认没人同时在操作收藏。

## 3. 覆盖的检查项（当前 v5）
- 默认浅色（即使系统为深色）、白色页面底；切换深色并刷新后保持；切回浅色写入 localStorage。
- 12 个话题、33 张原帖卡片全部指向 `https://x.com/<user>/status/<id>`、`target=_blank`、`rel=noopener`；每张有时间。
- 显示名、历史日期列表。
- 点击话题 → 右侧 AI 摘要切换；选中前后卡片位置/尺寸不变（无布局位移）。
- 无 Tab、按排名 #1…#12；右栏只有摘要面板（无搜索框、无今日要点）；无手机端今日要点折叠块。
- 卡片样式：浅色 白卡/中栏 `#f5f5f5`，深色 `#16181c`/`#000`；未选中透明边框、选中 `#1d9bf0` 边框；无阴影；圆角 ≥12；间距 ≥8；选中排名蓝色药丸。
- 搜索页：输入框位于中栏顶部且自动聚焦；日报页隐藏；“Gemini”有结果且高亮；URL hash 带 q。
- 分类 chip 筛选；收藏写入服务器 → 徽标数 → 收藏页 → 取消后恢复；趋势 3 个表；趋势话题 → 搜索；导出链接与 `/api/export` 附件；日期切换。
- 手机：默认浅色、顶栏主题切换、右栏隐藏、12 个内嵌摘要且位于原帖下方、无横向溢出、搜索框可见可用、日期下拉切换。
- 全程无 JS 错误 / console error。

## 4. 测试 bot 职责
- PR 上：拉分支 → `npm run check` → 本地 `wrangler dev` 跑 UI 测试 → 新功能补用例 → 在 PR 中贴结果与截图 → Approve 或 Request changes。
- 部署后：对线上跑 UI 测试 + API 冒烟，结果回帖到 Issue。
- UI 改动：对照 `docs/design/ui-spec.md` 与设计稿截图做视觉检查。
