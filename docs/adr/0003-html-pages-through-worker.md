# ADR 0003：`/`、`/search`、`/archive`、`/me` 先经过 Worker（输出 og 标签）

- 状态：已批准（贾维斯，2026-10-10）
- 相关：#9（F2）、PR #27、PRD #26（og:image 规则）、ADR 0002
- 推翻：之前"`/` 保持静态缓存、不经过 Worker"的约定（F1 / PR #23 时的 `wrangler.jsonc` 注释）

## 背景

F1 时 `/` 直接由静态资源层返回 `index.html`，不调用 Worker，也就没有 og 标签。PRD #26 规定了 og:image 的取值：

- `/` 指向当天的卡片 `/og/day/<最新日期>.png`；
- `/search`、`/archive`、`/me` 指向静态默认品牌图；
- 404 页不输出 og 标签。

爬虫不执行 JS，标签必须写在服务端返回的 HTML 里。静态的 `index.html` 只有一份，不知道"最新日期"是哪天，也不知道当前域名（og:image 和 og:url 要求绝对地址），所以做不到。

## 决定

- `run_worker_first` 加上 `/`、`/search`、`/archive`、`/me`（另有 F2 的 `/story/*`、`/og/day/*`、`/og/story/*`）。
- Worker（`apps/api/src/routes/pages.ts`）从 `env.ASSETS` 取 `index.html`，用 HTMLRewriter 替换 `<title>` 和 description，并写入 og、twitter 和 canonical 标签（`apps/api/src/lib/og.ts`）：
  - `/`：查一次 D1（最新日期 + 当天要点，两条按主键的小查询），og:image 是 `/og/day/<最新日期>.png`；
  - `/search`、`/archive`、`/me`：不查库，og:image 是 `/og/default-og.png`。
- 注入了 og 的 HTML 一律 `Cache-Control: public, max-age=0, must-revalidate, s-maxage=300`：
  - 浏览器不缓存，每次都重新验证。Worker 对注入后的 HTML 算内容哈希，作为弱 ETag（`W/"<sha-256 前 16 位>"`）；`If-None-Match` 命中时返回 304，不必重新下载。不会用静态 `index.html` 的 ETag，因为正文已经改写。
  - 这样发版后浏览器不会继续用旧 HTML 去请求已被删除的旧哈希 JS（否则会 404 白屏，测试工程师 2026-10-10 指出）。
  - 只允许共享缓存或边缘缓存存 5 分钟（`s-maxage=300`）。每天 08:50 更新后，爬虫最多 5 分钟就能拿到当天的卡片。
  - 404 页仍然是 `no-store`。
- `/?d=<date>` 仍由前端替换成 `/day/<date>`（PRD #26 允许首个请求返回 200）。
- `/assets/*` 的处理不变（ADR 0002）；`/theme.js`、`/brand/*` 仍不经过 Worker。

## 代价

- 每次打开这四个页面多一次 Worker 调用；首页再多一次 D1 小查询（读几行）。
- 部署工程师评估：离免费额度（**每天 10 万次 Worker 请求、500 万行 D1 读取**）很远。加上 ADR 0002 的 `/assets/*`，一位新访客首屏大约 4–7 次 Worker 调用，回访更少：静态资源有一年缓存；HTML 每次都要验证，但内容没变时只返回 304。
- 浏览器每次打开都要向 Worker 验证一次（大多是 304），换来的是发版后不会白屏。边缘缓存最多 5 分钟，日报更新后爬虫最多 5 分钟内仍可能拿到前一天的首页 HTML，可以接受。

## 以后

- 访问量上来后，可以用 Cache API（`caches.default`，按 300 秒存，回给浏览器的头保持 `max-age=0`）或边缘缓存规则缓存这几页注入后的 HTML，减少 Worker 里的 D1 查询；`/og/…` 图片路由已经这样做了。
- 如果哪天不再需要首页的动态 og:image，可以把 `/` 从 `run_worker_first` 去掉，回到纯静态。
