import type { MiddlewareHandler } from 'hono';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Localhost-only rule shared by HTTP and WebSocket upgrades.
 * Host must be exactly `127.0.0.1:<port>` or `localhost:<port>` (defeats DNS rebinding).
 * For mutating methods Origin must be absent or exactly `http://127.0.0.1:<port>` / `http://localhost:<port>`.
 */
export function isAllowedRequest(
  host: string | undefined,
  origin: string | undefined,
  method: string,
  port: number,
  opts?: { upgrade?: boolean },
): boolean {
  if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) return false;
  // WebSocket upgrades are GETs but must be treated as mutating (cross-site WebSocket hijacking).
  if ((opts?.upgrade === true || MUTATING.has(method.toUpperCase())) && origin !== undefined) {
    if (origin !== `http://127.0.0.1:${port}` && origin !== `http://localhost:${port}`) return false;
  }
  return true;
}

/** True when a Content-Type header names JSON (`application/json`, any parameters, any case). */
export function isJsonContentType(value: string | undefined): boolean {
  return (value ?? '').split(';')[0]!.trim().toLowerCase() === 'application/json';
}

export function guard(port: () => number): MiddlewareHandler {
  return async (c, next) => {
    if (!isAllowedRequest(c.req.header('host'), c.req.header('origin'), c.req.method, port())) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    // Every mutating /api call must be JSON, body or not. A cross-site page can only send JSON after a
    // CORS preflight, which this server never answers, so simple (no-cors) requests cannot mutate anything.
    if (MUTATING.has(c.req.method.toUpperCase()) && c.req.path.startsWith('/api/') && !isJsonContentType(c.req.header('content-type'))) {
      return c.json({ error: 'Content-Type must be application/json' }, 415);
    }
    await next();
  };
}
