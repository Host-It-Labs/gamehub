import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig } from 'vite';
// Node serves the exported frontend in production; Vite proxies its API in development.
export default defineConfig({
  css: { postcss: { plugins: [tailwindcss()] } },
  server: {
    host: '0.0.0.0',
    strictPort: true,
    watch: { useFsEvents: false, usePolling: true },
    proxy: {
      '/api': { target: `http://127.0.0.1:${process.env.API_PORT ?? 3018}` },
    },
  },
  resolve: { dedupe: ['react', 'react-dom'] },
  optimizeDeps: {
    include: [
      'react',
      'react-dom/client',
      '@base-ui/react/dialog',
      '@base-ui/react/switch',
      '@base-ui/react/button',
    ],
  },
  plugins: [vinext()],
});
