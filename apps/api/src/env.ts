/** Worker bindings (see wrangler.jsonc) */
export interface Bindings {
  DB: D1Database;
  ASSETS: Fetcher;
  /** pre-rendered share cards (PR #22, scripts/prerender-cards.mjs); optional: without it /og/* serves the default image */
  CARDS?: KVNamespace;
  FAVORITES_MAX?: string;
}

export interface AppEnv {
  Bindings: Bindings;
}
