import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The build output (dist/) is served as Workers Static Assets by apps/api (one Worker).
// Entry/CSS keep the stable legacy names /app.js and /style.css (public URLs pinned by tests/api);
// any extra chunks/assets are content-hashed under /assets/.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        entryFileNames: 'app.js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: (info) =>
          info.names.some((n) => n.endsWith('.css')) ? 'style.css' : 'assets/[name]-[hash][extname]',
      },
    },
  },
  server: {
    port: 5173,
    // `pnpm dev:web` (HMR) talks to a running `wrangler dev` (pnpm dev) for /api
    proxy: { '/api': 'http://127.0.0.1:8787' },
  },
});
