import type { Plugin } from 'vite';
import { mergeConfig } from 'vitest/config';
import base from './vite.config';
import { readFile } from 'node:fs/promises';
export default mergeConfig(base, {
  plugins: [
    {
      name: 'e2e-owned-server-cleanup',
      configureServer(server) {
        server.middlewares.use('/__e2e__/shutdown', async (req, res, next) => {
          const { token } = JSON.parse(
            await readFile(new URL('../backend/.local/e2e-session.json', import.meta.url), 'utf8'),
          );
          if (req.method !== 'POST' || req.headers['x-e2e-token'] !== token) return next();
          res.end('stopping');
          setTimeout(() => void server.close(), 100);
        });
      },
    } satisfies Plugin,
  ],
  server: {
    port: 5174,
    proxy: { '/api': { target: 'http://127.0.0.1:4001', changeOrigin: true } },
  },
});
