# ADR 0001：前端用 preact/compat 运行 React 代码

- 状态：已批准（贾维斯，2026-10-10）
- 相关：#8（F1 首页改版）、#16（首屏 JS 预算）、PR #23

## 背景

PRD 要求首屏 JS ≤ 60 KB（gzip），`scripts/check-bundle.mjs` 在 CI 里卡这条线（统计 `index.html` 引用的 script 和 modulepreload）。

- 改版前（React 19 + react-dom + react-router）：首屏约 **89.5 KB** gzip，超预算。
- 只算 react-dom 就约 67 KB gzip，单靠懒加载和拆包降不到 60 KB 以内。
- 本 PR 的同一份代码直接用原生 React 构建：首屏 **77.7 KB** gzip（vendor 65.8 + index 11.7 + theme.js 0.2，2026-10-10 实测），依然超预算。

## 决定

- 代码照常按 React API 写（`import … from 'react'`，类型用 `@types/react`），构建时由 `apps/web/vite.config.ts` 里的 `resolve.alias` 换成 `preact/compat`（约 6 KB gzip）。
- 去掉 react-router，改用自己写的小路由 `apps/web/src/lib/router.ts`（History API + `useSyncExternalStore`，约 1 KB），路由表在 `src/state/route.ts`。
- 除首页外的页面懒加载，框架代码单独打成 `vendor` chunk，资源带哈希并设一年 immutable 缓存。
- 结果：首屏 **19.6 KB** gzip（theme.js 0.2 + index 11.2 + vendor 7.8），预算 60 KB 保持不变。

## 代价

1. **不支持的 React 19 API**：preact/compat 没有实现，运行时会是 undefined，或者被静默忽略。
   - `use`
   - `useActionState`
   - `useOptimistic`
   - `useFormStatus`、`requestFormReset`（react-dom）
   - 表单 actions：`<form action={fn}>`、`<button formAction={fn}>`（写成 URL 字符串的 action 没问题）

   ESLint 会拒绝这些写法（`eslint.config.mjs` 里的 `preactCompatRules`，用 `no-restricted-imports` 和 `no-restricted-syntax` 实现），反例自测见 `tests/unit/eslint-preact-compat.test.mjs`。以后如果发现别的不兼容 API，加进 `PREACT_COMPAT_UNSUPPORTED` 即可。
2. **自己写的路由替代 react-router**：没有 loader/action、嵌套路由、滚动恢复这些功能，需要时得自己补。路由解析和旧链接跳转有单测（`route.test.ts`）。
3. Context 要用 `<Ctx.Provider>`（React 19 的 `<Ctx>` 简写 preact 不支持）；依赖 React 内部实现的第三方库（如部分动画库、状态库）引入前要先验证。
4. React DevTools 换成 Preact DevTools。

## 如何换回原生 React

1. 删掉 `apps/web/vite.config.ts` 里 `resolve: { alias: PREACT_ALIASES },` 这一行（`PREACT_ALIASES` 常量可以一起删）。`vendor` chunk 的规则已经包含 react / react-dom / scheduler，不用改。
2. 把首屏预算调到约 **80 KB**：在 `scripts/check-bundle.mjs` 里改默认值，或设环境变量 `INITIAL_JS_GZIP_BUDGET`。实测 77.7 KB，留一点余量；这同时需要产品同意改 PRD 里的 60 KB。
3. 可以去掉 `eslint.config.mjs` 里的 `...preactCompatRules`，并从 `apps/web/package.json` 移除 `preact`，然后 `pnpm install` 更新 lockfile。
4. 跑 `bash scripts/ci-local.sh --ui`。原生 React 版本 2026-10-10 只验证过能构建，没有跑过 UI 测试。
