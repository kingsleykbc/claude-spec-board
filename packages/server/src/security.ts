import type { MiddlewareHandler } from 'hono';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Localhost-only rule shared by HTTP and WebSocket upgrades.
 * Host must be exactly `127.0.0.1:<port>` or `localhost:<port>` (defeats DNS rebinding).
 * For mutating methods Origin must be absent or exactly `http://127.0.0.1:<port>` / `http://localhost:<port>`.
 */
export function isAllowedRequest(host: string | undefined, origin: string | undefined, method: string, port: number): boolean {
  if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) return false;
  if (MUTATING.has(method.toUpperCase()) && origin !== undefined) {
    if (origin !== `http://127.0.0.1:${port}` && origin !== `http://localhost:${port}`) return false;
  }
  return true;
}

export function guard(port: () => number): MiddlewareHandler {
  return async (c, next) => {
    if (!isAllowedRequest(c.req.header('host'), c.req.header('origin'), c.req.method, port())) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    await next();
  };
}
