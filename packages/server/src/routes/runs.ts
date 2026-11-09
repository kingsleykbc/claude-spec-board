import { Hono } from 'hono';
import type { Context } from 'hono';
import { loadProject } from '@specboard/core';
import type { RunKind } from '../claude/classify.js';
import { ClaudeUnavailableError, NotApprovedError, RunBusyError, type RunManager } from '../claude/runs.js';
import type { ClaudeStatus } from '../claude/status.js';
import { HttpError, onError, readJson } from '../http.js';
import { RegistryUnreadableError, type ProjectEntry, type Registry } from '../registry.js';
import type { ApprovedPermissions } from '../setup.js';

const KINDS: readonly RunKind[] = ['run', 'write-up', 'fix-file', 'refresh-overview'];
const SPEC_ID = /^T-\d{3,}$/;

export interface RunRouteDeps {
  registry: Registry;
  runs: RunManager;
  approved: ApprovedPermissions;
  status: () => Promise<ClaudeStatus>;
}

export function runRoutes(deps: RunRouteDeps): Hono {
  const app = new Hono();

  const project = async (c: Context): Promise<ProjectEntry> => {
    const entry = await deps.registry.get(c.req.param('pid') ?? '');
    if (!entry) throw new HttpError(404, 'Unknown project');
    return entry;
  };

  /** The project's current run, or a 404 when `runId` is not it: another run is never touched. */
  const currentRun = async (c: Context): Promise<{ entry: ProjectEntry; runId: string }> => {
    const entry = await project(c);
    const runId = c.req.param('runId') ?? '';
    if (deps.runs.current(entry.id)?.id !== runId) throw new HttpError(404, 'Unknown run');
    return { entry, runId };
  };

  app.post('/api/projects/:pid/runs', async (c) => {
    const entry = await project(c);
    const b = await readJson(c);
    const kind = KINDS.find((k) => k === b.kind);
    if (kind === undefined) throw new HttpError(400, 'Missing or invalid "kind"');
    let specId: string | null = null;
    if (kind === 'refresh-overview') {
      if (b.specId !== undefined) throw new HttpError(400, 'refresh-overview takes no "specId"');
    } else {
      if (typeof b.specId !== 'string' || !SPEC_ID.test(b.specId)) throw new HttpError(400, 'Missing or invalid "specId"');
      specId = b.specId;
      if (!(await loadProject(entry.root)).specs.some((s) => s.id === specId)) throw new HttpError(404, `Spec ${specId} not found`);
    }
    try {
      return c.json({ run: await deps.runs.start(entry, kind, specId) }, 202);
    } catch (e) {
      if (e instanceof RunBusyError) return c.json({ error: e.message, run: e.run }, 409);
      if (e instanceof NotApprovedError) return c.json({ error: e.message, setup: 'not-approved', command: 'specboard init' }, 412);
      if (e instanceof ClaudeUnavailableError) return c.json({ error: e.message, claude: e.reason, ...(e.blockedBy ? { blockedBy: e.blockedBy } : {}) }, 503);
      if (e instanceof RegistryUnreadableError) return c.json({ error: e.message }, 503);
      throw e;
    }
  });

  app.post('/api/projects/:pid/runs/:runId/stop', async (c) => {
    const { entry, runId } = await currentRun(c);
    await deps.runs.stop(entry.id, runId);
    return c.json({ run: deps.runs.current(entry.id) }, 202);
  });

  app.post('/api/projects/:pid/runs/:runId/dismiss', async (c) => {
    const { entry, runId } = await currentRun(c);
    deps.runs.dismiss(entry.id, runId);
    return c.body(null, 204);
  });

  app.get('/api/projects/:pid/run', async (c) => {
    const entry = await project(c);
    let approved = false;
    try {
      approved = (await deps.approved.get(entry.id, entry.root)) !== null;
    } catch (e) {
      console.error(`Cannot read the approved permissions: ${e instanceof Error ? e.message : String(e)}`);
    }
    let claude: ClaudeStatus = { installed: false, loggedIn: false, version: null };
    try {
      claude = await deps.status();
    } catch (e) {
      console.error(`Claude status check failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    return c.json({ run: deps.runs.current(entry.id), claude, approved });
  });

  app.onError(onError);
  return app;
}
