import path from 'node:path';
import type { IncomingMessage } from 'node:http';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { shouldRewriteOrigin } from './src/lib/devProxy';

const target = 'http://127.0.0.1:4949';

/** Vite's own port: `server.port` (CLI `--port` included), default 5173, then the port it actually bound. */
let vitePort = 5173;
const trackPort: Plugin = {
  name: 'specboard-track-port',
  configResolved(config) {
    vitePort = config.server.port ?? 5173;
  },
  configureServer(server) {
    server.httpServer?.once('listening', () => {
      const addr = server.httpServer?.address();
      if (addr && typeof addr === 'object') vitePort = addr.port;
    });
  },
};

type Hook = (proxyReq: { setHeader(name: string, value: string): void }, req: IncomingMessage) => void;
interface ProxyLike {
  on(event: 'proxyReq' | 'proxyReqWs', fn: Hook): void;
}

/** Rewrite Origin to the server's own only for requests from the board page itself (F1). */
const rewriteOrigin: Hook = (proxyReq, req) => {
  if (shouldRewriteOrigin(req.headers.origin, vitePort)) proxyReq.setHeader('origin', target);
};

/**
 * Dev proxy entry. The server only accepts its own Host and Origin, so `changeOrigin` rewrites Host and
 * the hooks rewrite Origin, but only when it is absent or Vite's own origin. A cross-site Origin is
 * forwarded unchanged and the server answers 403.
 */
const toServer = (ws: boolean) => ({
  target,
  ws,
  changeOrigin: true,
  configure: (proxy: ProxyLike) => {
    proxy.on('proxyReq', rewriteOrigin);
    proxy.on('proxyReqWs', rewriteOrigin);
  },
});

export default defineConfig({
  plugins: [react(), trackPort],
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
