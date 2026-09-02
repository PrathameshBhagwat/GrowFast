import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@growfast/shared-types': path.resolve(__dirname, '../../packages/shared-types/src'),
      '@growfast/ui': path.resolve(__dirname, '../../packages/ui/src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            if (res && !res.headersSent && 'writeHead' in res) {
              (res as any).writeHead(503, { 'Content-Type': 'application/json' });
              (res as any).end(JSON.stringify({ error: 'Backend offline', code: 'ECONNREFUSED' }));
            }
          });
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    exclude: ['node_modules', 'dist', 'e2e/**'],
  },
});
