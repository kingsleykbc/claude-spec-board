/**
 * Vite dev proxy decision (used by vite.config.ts only).
 *
 * The server accepts mutating requests only from its own origin. In dev the browser talks to Vite, so
 * requests from the board page carry Vite's origin and the proxy must rewrite it. Any other Origin
 * (a cross-site page) is forwarded unchanged so the server's guard answers 403.
 */
export function shouldRewriteOrigin(origin: string | undefined, vitePort: number): boolean {
  if (origin === undefined || origin === '') return true;
  return origin === `http://localhost:${vitePort}` || origin === `http://127.0.0.1:${vitePort}`;
}
