# @ai-daily/share-card

分享卡渲染器（F3），供预生成脚本 `scripts/prerender-cards.mjs`（PR #22）和以后的 F3 使用。**F2 只提供接口和占位实现**：返回尺寸准确的纯品牌紫（#7D5AF0）PNG，satori 渲染在 F3 实现。

## 接口

入口是 `packages/share-card/src/index.ts`，具名导出：

| 导出 | 说明 |
|---|---|
| `renderCard({ kind, size, data }) => Promise<Uint8Array>` | `kind`: `'day'` \| `'story'`；`size`: `'og'`（横版 1200×630）\| `'save'`（竖版 1080×1440）；`data`: 每日卡片传当天的日报 JSON，话题卡片传 `{ day, story }`。返回 PNG 字节。 |
| `CARD_SIZES` | `{ og: {width:1200,height:630}, save: {width:1080,height:1440} }` |
| `cardKey(kind, idOrDate, size)` | KV key：`card/{kind}/{id 或日期}/{og\|save}.png`，Worker 读取时用的是同一套规则 |
| `IS_PLACEHOLDER` | 占位实现期间为 `true`。`scripts/prerender-cards.mjs` 的 `loadRenderer()` 读到它时仍把渲染器记为 `placeholder`，所以生产 KV 的保护照样生效（不加 `--allow-placeholder` 就拒绝写入）。**F3 正式 `renderCard` 上线时必须把它改成 `false`（或删掉这个导出），否则预生成脚本会一直把渲染器当占位、拒绝写生产 KV**（部署工程师提醒） |

## 在 Node 里导入

不需要构建，Node 直接运行 TypeScript 源码：

```js
import { pathToFileURL } from 'node:url';
const { renderCard, cardKey, IS_PLACEHOLDER } = await import(pathToFileURL('packages/share-card/src/index.ts').href);
const png = await renderCard({ kind: 'story', size: 'og', data: { day, story } });
```

- **Node ≥ 22.18**：默认会去掉类型后运行 `.ts`（会打印一行 ExperimentalWarning，不影响结果）。本仓库本地和 CI 都是 22.23。
- **Node 22.12–22.17**：需要加参数 `node --experimental-strip-types scripts/prerender-cards.mjs …`。
- 为了保证能直接去掉类型运行，tsconfig 开了 `erasableSyntaxOnly`（不能用 enum、namespace 等），包内相对导入一律带 `.ts` 后缀，只依赖 Node 内置模块。
- F3 约定：wasm 和字体用 `node:fs` 按文件路径读取，不要用 Worker 特有的 `import x from './a.wasm'` 写法。
- 包里的 `exports` 指向 `./src/index.ts`，workspace 里也可以 `import { renderCard } from '@ai-daily/share-card'`（Vite / Vitest / wrangler 都能直接处理）。

## F3 待办

- [ ] 正式 `renderCard`（satori + resvg）上线时，把 `IS_PLACEHOLDER` 改成 `false` 或删掉这个导出；否则 `scripts/prerender-cards.mjs` 会一直拒写生产 KV。同时更新 `src/index.test.ts` 和 `tests/unit/prerender-cards.test.mjs` 里对它的断言。
