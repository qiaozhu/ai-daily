/** Worker bindings (see wrangler.jsonc) */
export interface Bindings {
  DB: D1Database;
  ASSETS: Fetcher;
  FAVORITES_MAX?: string;
}

export interface AppEnv {
  Bindings: Bindings;
}
