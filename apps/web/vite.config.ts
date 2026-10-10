import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// The build output (dist/) is served as Workers Static Assets by apps/api (one Worker).
//
// First-load budget (#16, PRD §5: initial JS <= 60 KB gzip, enforced by scripts/check-bundle.mjs):
// - The app is written against the React API (types from @types/react) but runs on preact/compat:
//   react-dom alone is ~67 KB gzip, preact/compat ~6 KB. Remove the aliases below to run on real React.
// - Routes other than the home page are lazy-loaded (React.lazy), the framework lives in its own `vendor` chunk.
// - Every built file is content-hashed under /assets/ and cached for a year (public/_headers);
//   index.html and /theme.js keep stable URLs and are revalidated.
const PREACT_ALIASES = [
  { find: /^react-dom\/client$/, replacement: 'preact/compat/client' },
  { find: /^react-dom$/, replacement: 'preact/compat' },
  { find: /^react\/jsx-runtime$/, replacement: 'preact/compat/jsx-runtime' },
  { find: /^react\/jsx-dev-runtime$/, replacement: 'preact/compat/jsx-dev-runtime' },
  { find: /^react$/, replacement: 'preact/compat' },
];

export default defineConfig({
  plugins: [tailwindcss()],
  resolve: { alias: PREACT_ALIASES },
  oxc: { jsx: { runtime: 'automatic', importSource: 'react' } },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        manualChunks: (id) => (/[\\/]node_modules[\\/]preact[\\/]/.test(id) ? 'vendor' : undefined),
      },
    },
  },
  server: {
    port: 5173,
    // `pnpm dev:web` talks to a running `wrangler dev` (pnpm dev) for /api
    proxy: { '/api': 'http://127.0.0.1:8787' },
  },
});
