import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, ConflictError } from './client';

const reply = (status: number, body?: unknown) =>
  vi.fn(async () => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));

describe('api client', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends the hash in a PATCH body and returns { hash, spec }', async () => {
    const f = reply(200, { hash: 'h2', spec: { id: 'T-101' } });
    vi.stubGlobal('fetch', f);
    const out = await api.setSubtask('p 1', 'T-101', 2, 'h1', true);
    expect(out.hash).toBe('h2');
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/projects/p%201/specs/T-101/subtasks/2');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(String(init.body))).toEqual({ hash: 'h1', done: true });
  });

  it('a 409 rejects with ConflictError carrying the current hash and text', async () => {
    vi.stubGlobal('fetch', reply(409, { conflict: true, currentHash: 'cur', currentText: 'text' }));
    const err = await api.setMeta('p', 'T-1', 'old', 'urgency', 'high').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictError);
    expect(err).toMatchObject({ currentHash: 'cur', currentText: 'text' });
  });

  it('other 4xx/5xx reject with ApiError { status, message }', async () => {
    vi.stubGlobal('fetch', reply(400, { error: 'Invalid value for urgency' }));
    const err = await api.setMeta('p', 'T-1', 'h', 'urgency', 'high').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 400, message: 'Invalid value for urgency' });
  });

  it('204 responses resolve and query strings are encoded', async () => {
    const f = reply(204);
    vi.stubGlobal('fetch', f);
    await api.removeReference('p', 'docs/A B.md');
    expect((f.mock.calls[0] as unknown as [string])[0]).toBe('/api/projects/p/references?path=docs%2FA%20B.md');
  });

  it('every mutating request is application/json; body-less ones send {}', async () => {
    const f = reply(204);
    vi.stubGlobal('fetch', f);
    await api.archive('p', 'T-1');
    await api.unarchive('p', 'T-1');
    await api.removeReference('p', 'docs/A.md');
    const c = reply(202, { run: null });
    vi.stubGlobal('fetch', c);
    await api.stopRun('p', 'r1');
    const calls = [...f.mock.calls, ...c.mock.calls] as unknown as Array<[string, RequestInit]>;
    expect(calls).toHaveLength(4);
    for (const [, init] of calls) {
      expect((init.headers as Record<string, string>)['content-type']).toBe('application/json');
      expect(init.body).toBe('{}');
    }
    expect(calls[2]![1].method).toBe('DELETE');
    // GETs carry no body or content-type.
    const g = reply(200, []);
    vi.stubGlobal('fetch', g);
    await api.projects();
    const [, gi] = g.mock.calls[0] as unknown as [string, RequestInit];
    expect(gi.body).toBeUndefined();
    expect((gi.headers as Record<string, string>)['content-type']).toBeUndefined();
  });

  it('run endpoints: paths, bodies, and error bodies kept on ApiError', async () => {
    const f = reply(202, { run: { id: 'r1' } });
    vi.stubGlobal('fetch', f);
    await api.startRun('p/1', 'run', 'T-1');
    await api.startRun('p/1', 'refresh-overview');
    await api.dismissRun('p/1', 'r1');
    await api.getRun('p/1');
    const calls = f.mock.calls as unknown as Array<[string, RequestInit]>;
    expect(calls.map(([u, init]) => init.method + ' ' + u)).toEqual([
      'POST /api/projects/p%2F1/runs',
      'POST /api/projects/p%2F1/runs',
      'POST /api/projects/p%2F1/runs/r1/dismiss',
      'GET /api/projects/p%2F1/run',
    ]);
    expect(JSON.parse(calls[0]![1].body as string)).toEqual({ kind: 'run', specId: 'T-1' });
    expect(JSON.parse(calls[1]![1].body as string)).toEqual({ kind: 'refresh-overview' });
    vi.stubGlobal('fetch', reply(409, { error: 'busy', run: { id: 'r0' } }));
    await expect(api.startRun('p', 'run', 'T-1')).rejects.toMatchObject({ status: 409, body: { run: { id: 'r0' } } });
    vi.stubGlobal('fetch', reply(412, { error: 'no', setup: 'not-approved', command: 'specboard init' }));
    await expect(api.startRun('p', 'run', 'T-1')).rejects.toMatchObject({ status: 412, body: { setup: 'not-approved' } });
  });
});
