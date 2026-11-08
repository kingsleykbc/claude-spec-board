import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const target = 'http://127.0.0.1:4949';

interface ProxyLike {
  on(event: 'proxyReq' | 'proxyReqWs', fn: (req: { setHeader(name: string, value: string): void }) => void): void;
}

/**
 * Dev proxy entry. The server only accepts its own Host and Origin (Ruling 2), so
 * `changeOrigin` rewrites Host and the hooks rewrite Origin.
 */
const toServer = (ws: boolean) => ({
  target,
  ws,
  changeOrigin: true,
  configure: (proxy: ProxyLike) => {
    proxy.on('proxyReq', (req) => req.setHeader('origin', target));
    proxy.on('proxyReqWs', (req) => req.setHeader('origin', target));
  },
});

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': toServer(false),
      '/ws': toServer(true),
    },
  },
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,
  },
});
