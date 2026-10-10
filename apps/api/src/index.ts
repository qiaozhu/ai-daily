// AI daily — Cloudflare Worker: Hono API (/api/*) + Workers Static Assets (apps/web build) + D1
import { createApp } from './app.ts';
import type { Bindings } from './env.ts';

const app = createApp();

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<Bindings>;
