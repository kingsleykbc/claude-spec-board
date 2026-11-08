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

  it('claude stubs resolve as { stub: true } on 501', async () => {
    vi.stubGlobal('fetch', reply(501, { stub: true, action: 'run' }));
    await expect(api.claude('run', { id: 'T-1' })).resolves.toEqual({ stub: true });
  });
});
