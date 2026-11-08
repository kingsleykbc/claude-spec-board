import { Hono } from 'hono';
import { HttpError, onError } from '../http.js';

const ACTIONS = new Set(['run', 'stop', 'write-up', 'fix-file', 'refresh-overview']);

/** Stubs for the Claude Code bridge (M3). */
export function claudeRoutes(): Hono {
  const app = new Hono();
  app.post('/api/claude/:action', (c) => {
    const action = c.req.param('action');
    if (!ACTIONS.has(action)) throw new HttpError(404, 'Unknown action');
    return c.json({ stub: true, action }, 501);
  });
  app.onError(onError);
  return app;
}
