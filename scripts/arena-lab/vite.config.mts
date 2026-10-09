import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

/**
 * The Arena dev bench (components/game/arena/arena-lab.tsx) on its own
 * Vite server, without the rest of Gamehub: another game's half-finished
 * edit in the shared tree can't break troop reviews. Started by
 * `node scripts/arena-lab/serve.mjs` (detached, port 3027).
 */
const repo = fileURLToPath(new URL('../../', import.meta.url));
export default defineConfig({
  root: fileURLToPath(new URL('./', import.meta.url)),
  publicDir: `${repo}public`,
  cacheDir: `${repo}node_modules/.vite-arena-lab`,
  plugins: [react()],
  optimizeDeps: {
    entries: ['index.html'],
    include: ['react', 'react-dom/client', 'three'],
  },
  resolve: { alias: { '@': repo.replace(/\/$/, '') } },
  server: {
    host: '127.0.0.1',
    port: Number(process.env.ARENA_LAB_PORT ?? 3027),
    strictPort: true,
    // Each review opens the page afresh; live reloads mid-capture would
    // restart a cycle.
    hmr: false,
    fs: { allow: [repo] },
  },
  css: { postcss: { plugins: [] } },
});
