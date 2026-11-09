import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { hashText } from '@specboard/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { ClaudeUnavailableError, NotApprovedError, RunBusyError, RunManager, type RunSnapshot } from '../src/claude/runs.js';
import type { ClaudeStatus } from '../src/claude/status.js';
import { Registry, type ProjectEntry } from '../src/registry.js';
import { ApprovedPermissions, InvalidApprovalError, type Permissions } from '../src/setup.js';
import { fakeRuns } from './fakeRuns.js';

vi.setConfig({ testTimeout: 40000 });

const SAMPLE = path.resolve(import.meta.dirname, '../../../examples/recipe-box');
const FAKE = path.resolve(import.meta.dirname, 'fixtures', 'fake-claude.mjs');
const HOST = { Host: '127.0.0.1:4949', 'Content-Type': 'application/json' };
const APPROVED: Permissions = { allow: ['Read(./**)', 'Edit(./**)', 'Write(./**)', 'Bash(git status:*)'], deny: ['Bash(git push:*)', 'Edit(./.claude/**)'] };
const OK_STATUS: ClaudeStatus = { installed: true, loggedIn: true, version: '2.1.302' };

let tmp: string;
let entry: ProjectEntry;
let reg: Registry;
let approved: ApprovedPermissions;
const managers: RunManager[] = [];

const snap = (over: Partial<RunSnapshot> = {}): RunSnapshot => ({
  id: 'r1', pid: entry.id, kind: 'run', specId: 'T-101', status: 'running', lines: [], end: null, startedAt: '2026-11-09T10:00:00.000Z', dismissed: false, ...over,
});

function appWith(runs: ReturnType<typeof fakeRuns> | RunManager, status: () => Promise<ClaudeStatus> = async () => OK_STATUS, store = approved) {
  return createApp({ registry: reg, port: () => 4949, webDist: null, runs: runs as RunManager, approved: store, status });
}

function post(app: ReturnType<typeof createApp>, url: string, body?: unknown, headers: Record<string, string> = {}) {
  return app.request(url, { method: 'POST', headers: { ...HOST, ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
}

function realManager(scenario: string): RunManager {
  let n = 0;
  const m = new RunManager({
    approved,
    emit: () => {},
    status: async () => OK_STATUS,
    roots: async () => [],
    command: (args) => ({ bin: process.execPath, args: [FAKE, scenario, path.join(tmp, `record-${++n}.json`), ...args] }),
  });
  managers.push(m);
  return m;
}

beforeEach(async () => {
  tmp = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'sb-runs-routes-')));
  const root = path.join(tmp, 'recipe-box');
  await fs.cp(SAMPLE, root, { recursive: true });
  reg = new Registry(path.join(tmp, 'projects.json'));
  entry = await reg.add(root);
  approved = new ApprovedPermissions(path.join(tmp, 'permissions.json'));
  await approved.set(entry.id, entry.root, APPROVED);
});

afterEach(async () => {
  await Promise.all(managers.splice(0).map((m) => m.close()));
  vi.restoreAllMocks();
  await fs.rm(tmp, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
});

describe('POST /runs validation', () => {
  it.each([['T-1; rm -rf'], ['T-001 --help'], ['../T-001'], ['T-001\n'], ['t-001'], [''], [42], [null], [['T-101']], [{ id: 'T-101' }]])('rejects specId %j with 400 and never starts', async (specId) => {
    const runs = fakeRuns();
    const res = await post(appWith(runs), `/api/projects/${entry.id}/runs`, { kind: 'run', specId });
    expect(res.status).toBe(400);
    expect(runs.start).not.toHaveBeenCalled();
  });

  it('rejects a missing or unknown kind', async () => {
    const runs = fakeRuns();
    const app = appWith(runs);
    for (const body of [{}, { specId: 'T-101' }, { kind: 'stop', specId: 'T-101' }, { kind: 'RUN', specId: 'T-101' }, { kind: 7 }, { kind: ['run'], specId: 'T-101' }]) {
      expect((await post(app, `/api/projects/${entry.id}/runs`, body)).status, JSON.stringify(body)).toBe(400);
    }
    expect((await post(app, `/api/projects/${entry.id}/runs`, undefined)).status).toBe(400);
    expect(runs.start).not.toHaveBeenCalled();
  });

  it('needs a specId for run, write-up and fix-file and none for refresh-overview', async () => {
    const runs = fakeRuns();
    const app = appWith(runs);
    for (const kind of ['run', 'write-up', 'fix-file']) {
      expect((await post(app, `/api/projects/${entry.id}/runs`, { kind })).status, kind).toBe(400);
    }
    for (const specId of ['T-101', null, '']) {
      expect((await post(app, `/api/projects/${entry.id}/runs`, { kind: 'refresh-overview', specId })).status, String(specId)).toBe(400);
    }
    expect(runs.start).not.toHaveBeenCalled();
  });

  it('answers 404 for an unknown project and an unknown spec, without starting', async () => {
    const runs = fakeRuns();
    const app = appWith(runs);
    expect((await post(app, '/api/projects/deadbeef/runs', { kind: 'run', specId: 'T-101' })).status).toBe(404);
    const miss = await post(app, `/api/projects/${entry.id}/runs`, { kind: 'run', specId: 'T-999' });
    expect(miss.status).toBe(404);
    expect(runs.start).not.toHaveBeenCalled();
  });
});

describe('POST /runs outcomes', () => {
  it('starts a spec run and answers 202 with the run', async () => {
    const run = snap();
    const runs = fakeRuns({ start: vi.fn(async () => run) });
    const res = await post(appWith(runs), `/api/projects/${entry.id}/runs`, { kind: 'run', specId: 'T-101' });
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ run });
    expect(runs.start).toHaveBeenCalledWith(entry, 'run', 'T-101');
  });

  it('starts an overview refresh with no spec', async () => {
    const runs = fakeRuns({ start: vi.fn(async () => snap({ kind: 'refresh-overview', specId: null })) });
    const res = await post(appWith(runs), `/api/projects/${entry.id}/runs`, { kind: 'refresh-overview' });
    expect(res.status).toBe(202);
    expect(runs.start).toHaveBeenCalledWith(entry, 'refresh-overview', null);
  });

  it('maps the manager errors', async () => {
    const run = snap();
    const cases: [Error, number, Record<string, unknown>][] = [
      [new RunBusyError(run), 409, { run }],
      [new NotApprovedError(), 412, { setup: 'not-approved', command: 'specboard init' }],
      [new ClaudeUnavailableError('not-installed'), 503, { claude: 'not-installed' }],
      [new ClaudeUnavailableError('logged-out'), 503, { claude: 'logged-out' }],
    ];
    for (const [err, status, extra] of cases) {
      const runs = fakeRuns({ start: vi.fn(async () => { throw err; }) });
      const res = await post(appWith(runs), `/api/projects/${entry.id}/runs`, { kind: 'run', specId: 'T-101' });
      expect(res.status, err.name).toBe(status);
      expect(await res.json()).toEqual({ error: err.message, ...extra });
    }
  });

  it('keeps unknown start failures as a plain 500', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const runs = fakeRuns({ start: vi.fn(async () => { throw new Error('secret detail'); }) });
    const res = await post(appWith(runs), `/api/projects/${entry.id}/runs`, { kind: 'run', specId: 'T-101' });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Internal error' });
  });

  it('two concurrent POSTs give one 202 and one 409 carrying the running run; stop and dismiss only touch it', async () => {
    const app = appWith(realManager('idle'));
    const url = `/api/projects/${entry.id}/runs`;
    const both = await Promise.all([post(app, url, { kind: 'run', specId: 'T-101' }), post(app, url, { kind: 'run', specId: 'T-102' })]);
    expect(both.map((r) => r.status).sort()).toEqual([202, 409]);
    const accepted = (await both.find((r) => r.status === 202)!.json()) as { run: RunSnapshot };
    const busy = (await both.find((r) => r.status === 409)!.json()) as { error: string; run: RunSnapshot };
    expect(busy.run.id).toBe(accepted.run.id);
    expect(busy.error).toMatch(/already working/);

    // Another run's ID changes nothing.
    expect((await post(app, `${url}/other/stop`)).status).toBe(404);
    expect((await post(app, `${url}/other/dismiss`)).status).toBe(404);
    const mid = (await (await app.request(`/api/projects/${entry.id}/run`, { headers: HOST })).json()) as { run: RunSnapshot };
    expect(mid.run.status).toBe('running');

    expect((await post(app, `${url}/${accepted.run.id}/stop`)).status).toBe(202);
    const after = (await (await app.request(`/api/projects/${entry.id}/run`, { headers: HOST })).json()) as { run: RunSnapshot };
    expect(after.run.status).not.toBe('running');
    expect(after.run.dismissed).toBe(false);
    expect((await post(app, `${url}/${accepted.run.id}/stop`)).status).toBe(202); // finished: harmless
    expect((await post(app, `${url}/${accepted.run.id}/dismiss`)).status).toBe(204);
    const gone = (await (await app.request(`/api/projects/${entry.id}/run`, { headers: HOST })).json()) as { run: RunSnapshot };
    expect(gone.run.dismissed).toBe(true);
  });

  it('stop and dismiss act only on the current run of a known project', async () => {
    const runs = fakeRuns({ current: vi.fn(() => snap()) });
    const app = appWith(runs);
    expect((await post(app, '/api/projects/deadbeef/runs/r1/stop')).status).toBe(404);
    expect((await post(app, `/api/projects/${entry.id}/runs/zzz/stop`)).status).toBe(404);
    expect(runs.stop).not.toHaveBeenCalled();
    expect((await post(app, `/api/projects/${entry.id}/runs/r1/stop`)).status).toBe(202);
    expect(runs.stop).toHaveBeenCalledWith(entry.id, 'r1');
    expect((await post(app, `/api/projects/${entry.id}/runs/r1/dismiss`)).status).toBe(204);
    expect(runs.dismiss).toHaveBeenCalledWith(entry.id, 'r1');
  });
});

describe('GET /run', () => {
  const get = (app: ReturnType<typeof createApp>) => app.request(`/api/projects/${entry.id}/run`, { headers: HOST });

  it('has the documented shape', async () => {
    const run = snap();
    const res = await get(appWith(fakeRuns({ current: vi.fn(() => run) })));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ run, claude: OK_STATUS, approved: true });
  });

  it('says run:null when nothing ran, and 404 for an unknown project', async () => {
    const app = appWith(fakeRuns());
    expect(((await (await get(app)).json()) as { run: unknown }).run).toBeNull();
    expect((await app.request('/api/projects/deadbeef/run', { headers: HOST })).status).toBe(404);
  });

  it('reports approved:false, never a 500, for an unapproved project', async () => {
    const other = new ApprovedPermissions(path.join(tmp, 'none.json'));
    const res = await get(appWith(fakeRuns(), undefined, other));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { approved: boolean }).approved).toBe(false);
  });

  it('reports approved:false and logs for an invalid approval entry', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bad = { get: async () => { throw new InvalidApprovalError('rule is not allowed'); } } as unknown as ApprovedPermissions;
    const res = await get(appWith(fakeRuns(), undefined, bad));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { approved: boolean }).approved).toBe(false);
    expect(log).toHaveBeenCalled();
  });

  it('reports approved:false and logs for a malformed permissions.json', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    await fs.writeFile(path.join(tmp, 'permissions.json'), '{not json');
    const res = await get(appWith(fakeRuns()));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { approved: boolean }).approved).toBe(false);
    expect(log).toHaveBeenCalled();
  });

  it('never throws when the status check does', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await get(appWith(fakeRuns(), async () => { throw new Error('boom'); }));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { claude: ClaudeStatus }).claude).toEqual({ installed: false, loggedIn: false, version: null });
  });
});

describe('guards on the run routes', () => {
  it('answers 403 for a cross-origin POST, and 415 for text/plain, without starting', async () => {
    const runs = fakeRuns();
    const app = appWith(runs);
    const url = `/api/projects/${entry.id}/runs`;
    expect((await post(app, url, { kind: 'run', specId: 'T-101' }, { Origin: 'http://evil.com' })).status).toBe(403);
    const plain = await post(app, url, { kind: 'run', specId: 'T-101' }, { 'Content-Type': 'text/plain' });
    expect(plain.status).toBe(415);
    expect(runs.start).not.toHaveBeenCalled();
  });
});

describe('malformed front matter on edit', () => {
  const patchMeta = async (text: string) => {
    const specs = path.join(entry.root, '.specboard', 'specs');
    const dir = (await fs.readdir(specs)).find((d) => d.startsWith('T-101'))!;
    await fs.writeFile(path.join(specs, dir, 'spec.md'), text);
    return appWith(fakeRuns()).request(`/api/projects/${entry.id}/specs/T-101/meta`, {
      method: 'PATCH',
      headers: HOST,
      body: JSON.stringify({ hash: hashText(text), key: 'urgency', value: 'high' }),
    });
  };

  it('is 422 for broken YAML', async () => {
    const res = await patchMeta('---\nid: T-101\ntitle: [oops\n---\n\n## Spec\nx\n');
    expect(res.status).toBe(422);
    expect(((await res.json()) as { error: string }).error).toMatch(/^Front matter is not valid YAML/);
  });

  it('is 422 for no front matter', async () => {
    const res = await patchMeta('# Just text\n');
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: 'No front matter' });
  });
});
