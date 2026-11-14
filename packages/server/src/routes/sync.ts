import { Hono } from 'hono';
import { HttpError, onError } from '../http.js';
import type { Registry } from '../registry.js';
import { deleteProposal, parseProposal, readProposalText } from '../syncProposal.js';

export function syncRoutes(registry: Registry): Hono {
  const app = new Hono();

  app.get('/api/projects/:pid/sync-proposal', async (c) => {
    const entry = await registry.get(c.req.param('pid'));
    if (!entry) throw new HttpError(404, 'Unknown project');
    const raw = await readProposalText(entry.root);
    if (raw === null) return c.json({ exists: false });
    return c.json({ exists: true, ...parseProposal(raw) });
  });

  app.delete('/api/projects/:pid/sync-proposal', async (c) => {
    const entry = await registry.get(c.req.param('pid'));
    if (!entry) throw new HttpError(404, 'Unknown project');
    await deleteProposal(entry.root);
    return c.body(null, 204);
  });

  app.onError(onError);
  return app;
}
