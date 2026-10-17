# ADR 0002：`/assets/*` 先经过 Worker

- 状态：已批准（贾维斯，2026-10-10）
- 相关：#16、PR #23 测试审查

## 背景

构建产物在 `/assets/` 下，文件名带内容哈希，`apps/web/public/_headers` 给 `/assets/*` 设了一年的 `immutable` 缓存。之前 `run_worker_first` 里有 `!/assets/*`，这些请求不经过 Worker，直接交给静态资源层处理。

测试发现：请求一个不存在的文件（比如 `/assets/nope-123.js`，部署后旧页面引用的旧哈希就会这样）时，静态资源层按 `single-page-application` 规则返回首页 HTML，状态码 200，并且同样带上一年的 `immutable` 缓存。浏览器和 CDN 会把这份 HTML 当成 JS / CSS 缓存一年。

## 决定

- 从 `run_worker_first` 去掉 `!/assets/*`，并显式加上 `/assets` 和 `/assets/*`，让这些请求先经过 Worker。
- Worker（`apps/api/src/app.ts` 的 `assetOr404`）先向 `env.ASSETS` 取文件：
  - 取到真实文件：原样返回，保留 `_headers` 给的一年缓存。
  - 没取到，或取回的是 HTML 回退：返回 404 和 `Cache-Control: no-store`，正文为空。
- `/assets`、`/assets/`、编码异常的地址（如 `/assets/%ZZ.js`、`/assets/..%2findex.html`）也返回 404 + `no-store`；静态资源层拒绝处理的路径同样按 404 处理。
- 含 `..`、`%2e%2e` 的点号路径段，在路由之前就会被 URL 规范化掉（workerd、curl、浏览器和 Cloudflare 边缘都这样做）：`/assets/../index.html` 就是 `/index.html`，`/assets/%2e%2e/x` 就是 SPA 路由 `/x`，已经不在 `/assets` 下，Worker 看到的也是规范化后的地址。它们不会带上一年缓存，用例里有断言。
- 其它看起来像文件的缺失地址（`/*.*`）同样返回 404 + `no-store`。
- `/theme.js` 和 `/brand/*` 仍然不经过 Worker，它们是固定存在的文件。
- 黑盒用例在 `tests/api/read.test.mjs`：缺失的 `.js` / `.css`、`/assets`、`/assets/` 和异常路径 → 404、`no-store`、不是 HTML；存在的哈希文件 → 200 + 一年缓存，content-type 正确（js 是 javascript，css 是 text/css）。

## 代价

- 每个 `/assets/*` 请求都会调用一次 Worker：**每个 JS / CSS 文件各算一次 Worker 调用**，计入 Workers 免费额度（**每天 10 万次请求**）。
- 目前够用：首屏经过 Worker 的只有 `/assets/` 下 3 个文件（JS 入口、vendor chunk、CSS；`index.html` 和 `/theme.js` 不经过 Worker），文件名带哈希，浏览器缓存一年，回访用户基本不会再请求。按每位新访客约 3–6 次计算，每天约 1.5 万个新访客才会用到额度的一半。
- 访问量上来后再评估。退路（部署工程师建议）：把 `!/assets/*` 加回 `run_worker_first`，让静态文件重新不经过 Worker；缺失文件的问题改在前端处理（例如入口脚本加载失败时整页刷新、拿到新的 `index.html`），并在部署时保留上一版的哈希文件，减少缺失。也可以先给 `/assets/*` 加一条缓存规则或用 Cache API。

> 补充（2026-10-10）：F2 起 `/`、`/search`、`/archive`、`/me` 也经过 Worker（输出 og 标签），见 [ADR 0003](0003-html-pages-through-worker.md)；上文"`index.html` 不经过 Worker"的估算按 0003 更新。
