import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { ApiError, type ClaudeStatus, type RunEvent, type RunLine, type RunSnapshot, type RunState } from '../api/client';
import type { LiveMessage } from '../api/live';
import type { LiveChannel } from './useProject';

// useRun with the API mocked and a hand-driven LiveChannel (Review Focus 5).

type Deferred<T> = { resolve: (v: T) => void; reject: (e: unknown) => void };
const getRuns: Array<Deferred<RunState> & { pid: string }> = [];

const mocks = vi.hoisted(() => ({ startRun: vi.fn(), stopRun: vi.fn(), dismissRun: vi.fn() }));
vi.mock('../api/client', async (orig) => ({
  ...(await orig<typeof import('../api/client')>()),
  api: {
    getRun: vi.fn(
      (pid: string) =>
        new Promise<RunState>((resolve, reject) => {
          getRuns.push({ pid, resolve, reject });
        }),
    ),
    startRun: mocks.startRun,
    stopRun: mocks.stopRun,
    dismissRun: mocks.dismissRun,
  },
}));

const { api } = await import('../api/client');
const { useRun, mergeRun } = await import('./useRun');

const CLAUDE: ClaudeStatus = { installed: true, loggedIn: true, version: '2.0.0' };
const line = (seq: number): RunLine => ({ seq, k: 'read', text: `line ${seq}`, time: '10:00' });
const lines = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => line(from + i));
const run = (over: Partial<RunSnapshot> = {}): RunSnapshot => ({
  id: 'r1',
  pid: 'p1',
  kind: 'run',
  specId: 'T-1',
  status: 'running',
  lines: [],
  end: null,
  startedAt: '2026-11-08T10:00:00.000Z',
  dismissed: false,
  ...over,
});
const state = (r: RunSnapshot | null, approved = true): RunState => ({ run: r, claude: CLAUDE, approved });

function makeLive(conn: LiveChannel['conn'] = 'live') {
  const messages = new Set<(m: LiveMessage) => void>();
  const opens = new Set<() => void>();
  const live: LiveChannel = {
    conn,
    subscribe: (h) => {
      messages.add(h);
      return () => void messages.delete(h);
    },
    onOpen: (h) => {
      opens.add(h);
      return () => void opens.delete(h);
    },
  };
  return {
    live,
    send: (e: RunEvent | { type: 'hello' }) => act(() => [...messages].forEach((h) => h(e as unknown as LiveMessage))),
    open: () => act(() => [...opens].forEach((h) => h())),
    handlerCount: () => messages.size + opens.size,
  };
}

/** Mount, and answer the first fetch with `first`. */
async function mount(first: RunSnapshot | null, conn: LiveChannel['conn'] = 'live') {
  const l = makeLive(conn);
  const hook = renderHook((p: { pid: string }) => useRun(p.pid, l.live), { initialProps: { pid: 'p1' } });
  await answer(0, state(first));
  return { ...l, hook, result: hook.result };
}
const answer = (i: number, s: RunState) => act(async () => getRuns[i]!.resolve(s));
const seqs = (r: RunSnapshot | null) => r?.lines.map((l) => l.seq);

beforeEach(() => {
  getRuns.length = 0;
  vi.mocked(api.getRun).mockClear();
  Object.values(mocks).forEach((m) => m.mockReset());
});
afterEach(cleanup);

describe('useRun: events and snapshots', () => {
  it('loads the run, claude status and approval on mount', async () => {
    const { result } = await mount(run({ lines: lines(1, 2) }));
    expect(seqs(result.current.run)).toEqual([1, 2]);
    expect(result.current.claude).toEqual(CLAUDE);
    expect(result.current.approved).toBe(true);
  });

  it('a snapshot to seq 5, then events 4, 5, 6: no duplicates, in order, no re-fetch', async () => {
    const { result, send } = await mount(run({ lines: lines(1, 5) }));
    await send({ type: 'run-line', runId: 'r1', line: line(4) });
    await send({ type: 'run-line', runId: 'r1', line: line(5) });
    await send({ type: 'run-line', runId: 'r1', line: line(6) });
    expect(seqs(result.current.run)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(api.getRun).toHaveBeenCalledTimes(1);
  });

  it('a snapshot that starts after seq 1 (older lines were capped) is not a gap', async () => {
    const { result, send } = await mount(run({ lines: lines(40, 45) }));
    await send({ type: 'run-line', runId: 'r1', line: line(46) });
    expect(seqs(result.current.run)).toEqual([40, 41, 42, 43, 44, 45, 46]);
    expect(api.getRun).toHaveBeenCalledTimes(1);
  });

  it('a gap in seq re-fetches, once at a time, and does not loop when the snapshot still lacks the line', async () => {
    const { result, send } = await mount(run({ lines: lines(1, 5) }));
    await send({ type: 'run-line', runId: 'r1', line: line(8) });
    expect(api.getRun).toHaveBeenCalledTimes(2);
    expect(seqs(result.current.run)).toEqual([1, 2, 3, 4, 5]); // the skipped line is not applied
    await send({ type: 'run-line', runId: 'r1', line: line(9) });
    expect(api.getRun).toHaveBeenCalledTimes(2); // one in flight
    await answer(1, state(run({ lines: lines(1, 7) }))); // still no 8
    expect(seqs(result.current.run)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(api.getRun).toHaveBeenCalledTimes(2); // no loop
    await send({ type: 'run-line', runId: 'r1', line: line(8) });
    expect(seqs(result.current.run)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('a snapshot far ahead of what is held replaces the lines (no hole in the middle)', async () => {
    const { result, send } = await mount(run({ lines: lines(1, 3) }));
    await send({ type: 'run-line', runId: 'r1', line: line(9) });
    await answer(1, state(run({ lines: lines(6, 9) })));
    expect(seqs(result.current.run)).toEqual([6, 7, 8, 9]);
  });

  it('re-fetches after every socket open, and keeps working when a fetch fails', async () => {
    const { result, open } = await mount(run({ lines: lines(1, 2) }));
    await open();
    expect(api.getRun).toHaveBeenCalledTimes(2);
    await act(async () => getRuns[1]!.reject(new Error('down')));
    expect(seqs(result.current.run)).toEqual([1, 2]);
    await open(); // a reconnect
    expect(api.getRun).toHaveBeenCalledTimes(3);
    await answer(2, state(run({ lines: lines(1, 4), status: 'finished', end: { status: 'finished' } })));
    expect(result.current.run?.status).toBe('finished');
    expect(seqs(result.current.run)).toEqual([1, 2, 3, 4]);
  });

  it('a run-ended is not undone by a late running snapshot, and a late run-line of an ended run is dropped', async () => {
    const { result, send, open } = await mount(run({ lines: lines(1, 2) }));
    await open(); // fetch #2, answered late
    const ended = run({ lines: lines(1, 3), status: 'finished', end: { status: 'finished', title: 'Done' } });
    await send({ type: 'run-ended', run: ended });
    expect(result.current.run?.status).toBe('finished');
    await answer(1, state(run({ lines: lines(1, 2) }))); // taken while it was still running
    expect(result.current.run?.status).toBe('finished');
    expect(result.current.run?.end?.title).toBe('Done');
    expect(seqs(result.current.run)).toEqual([1, 2, 3]);
    await send({ type: 'run-line', runId: 'r1', line: line(4) });
    expect(seqs(result.current.run)).toEqual([1, 2, 3]);
    expect(api.getRun).toHaveBeenCalledTimes(2);
  });

  it('an ended snapshot ends a running run, and a dismissal is never undone', async () => {
    const { result, open } = await mount(run({ lines: lines(1, 2) }));
    await open();
    await answer(1, state(run({ lines: lines(1, 3), status: 'stopped', end: { status: 'stopped' }, dismissed: true })));
    expect(result.current.run).toMatchObject({ status: 'stopped', dismissed: true });
    await open();
    await answer(2, state(run({ status: 'running' })));
    expect(result.current.run).toMatchObject({ status: 'stopped', dismissed: true });
  });

  it('an event for another run: run-started replaces; run-line and run-ended re-fetch', async () => {
    const { result, send } = await mount(run({ lines: lines(1, 2) }));
    await send({ type: 'run-line', runId: 'other', line: line(1) });
    expect(api.getRun).toHaveBeenCalledTimes(2);
    await answer(1, state(run({ lines: lines(1, 2) })));
    await send({ type: 'run-ended', run: run({ id: 'other', status: 'finished' }) });
    expect(api.getRun).toHaveBeenCalledTimes(3);
    await answer(2, state(run({ lines: lines(1, 2) })));
    const next = run({ id: 'r2', startedAt: '2026-11-08T11:00:00.000Z', lines: [line(1)] });
    await send({ type: 'run-started', run: next });
    expect(result.current.run?.id).toBe('r2');
    await send({ type: 'run-line', runId: 'r2', line: line(2) });
    expect(seqs(result.current.run)).toEqual([1, 2]);
  });

  it('with no run held, a run-line re-fetches and a run-started is taken', async () => {
    const { result, send } = await mount(null);
    await send({ type: 'run-line', runId: 'r1', line: line(1) });
    expect(api.getRun).toHaveBeenCalledTimes(2);
    await answer(1, state(null));
    expect(result.current.run).toBeNull();
    await send({ type: 'run-started', run: run() });
    expect(result.current.run?.id).toBe('r1');
  });

  it('a snapshot with no run does not wipe a run that started meanwhile, but does clear a stale one', async () => {
    const { result, send, open } = await mount(null);
    await open();
    await send({ type: 'run-started', run: run() });
    await answer(1, state(null)); // requested before the start
    expect(result.current.run?.id).toBe('r1');
    await open();
    await answer(2, state(null)); // nothing since: the server really has none (restarted)
    expect(result.current.run).toBeNull();
  });

  it('ignores a snapshot of an older run than the one held', async () => {
    const { result, send, open } = await mount(null);
    await open();
    await send({ type: 'run-started', run: run({ id: 'r2', startedAt: '2026-11-08T11:00:00.000Z' }) });
    await answer(1, state(run({ id: 'r1', status: 'finished' })));
    expect(result.current.run?.id).toBe('r2');
  });
});

describe('useRun: onEvent fires for live events only', () => {
  it('fires for started, new lines and the end; not for duplicates, dropped lines or snapshots', async () => {
    const seen: string[] = [];
    const l = (e: RunEvent) => seen.push(e.type === 'run-line' ? `line ${e.line.seq}` : e.type);
    const m = await mount(null);
    const unsub = m.hook.result.current.onEvent(l);
    await m.send({ type: 'run-started', run: run() });
    await m.send({ type: 'run-line', runId: 'r1', line: line(1) });
    await m.send({ type: 'run-line', runId: 'r1', line: line(1) }); // duplicate
    await m.send({ type: 'run-line', runId: 'r1', line: line(2) });
    await m.send({ type: 'run-ended', run: run({ lines: lines(1, 2), status: 'finished' }) });
    await m.send({ type: 'run-ended', run: run({ lines: lines(1, 2), status: 'finished' }) }); // duplicate
    await m.send({ type: 'run-line', runId: 'r1', line: line(3) }); // late, dropped
    expect(seen).toEqual(['run-started', 'line 1', 'line 2', 'run-ended']);

    // A reconnect catching up with a newer run fires nothing.
    await m.open();
    await act(async () => getRuns.at(-1)!.resolve(state(run({ id: 'r9', startedAt: '2026-11-08T12:00:00.000Z', lines: lines(1, 5), status: 'finished' }))));
    expect(seen).toHaveLength(4);
    unsub();
    await m.send({ type: 'run-started', run: run({ id: 'r10', startedAt: '2026-11-08T13:00:00.000Z' }) });
    expect(seen).toHaveLength(4);
  });
});

describe('useRun: project switch', () => {
  it('resets state, ignores late answers from the previous project, and ignores its run events', async () => {
    const { hook, result, send } = await mount(run({ lines: lines(1, 2) }));
    expect(result.current.run?.id).toBe('r1');
    hook.rerender({ pid: 'p2' });
    expect(result.current.run).toBeNull();
    expect(result.current.claude).toBeNull();
    expect(getRuns[1]!.pid).toBe('p2');
    await send({ type: 'run-started', run: run({ id: 'x' }) }); // events now belong to p2 (one socket per project)
    expect(result.current.run?.id).toBe('x');
    // A late answer for p1 arrives (a second one from before the switch is simulated by a stale fetch):
    hook.rerender({ pid: 'p3' });
    await answer(1, state(run({ id: 'p2run' })));
    expect(result.current.run).toBeNull();
    await answer(2, state(run({ id: 'p3run' })));
    expect(result.current.run?.id).toBe('p3run');
  });

  it('a late answer from the first project after a switch does not land', async () => {
    const l = makeLive();
    const hook = renderHook((p: { pid: string }) => useRun(p.pid, l.live), { initialProps: { pid: 'p1' } });
    hook.rerender({ pid: 'p2' });
    await answer(0, state(run({ id: 'old' }))); // p1's fetch, still pending at the switch
    expect(hook.result.current.run).toBeNull();
    await answer(1, state(run({ id: 'new' })));
    expect(hook.result.current.run?.id).toBe('new');
  });

  it('unsubscribes from the channel on unmount', async () => {
    const { hook, handlerCount } = await mount(null);
    expect(handlerCount()).toBe(2);
    hook.unmount();
    expect(handlerCount()).toBe(0);
  });
});

describe('useRun: actions', () => {
  const err = (status: number, body: unknown) => new ApiError(status, (body as { error: string }).error, body);

  it('start maps each server error to its reason', async () => {
    const { result } = await mount(null);
    const busy = run({ id: 'busy' });
    const cases: Array<[ApiError | Error, Record<string, unknown>]> = [
      [err(409, { error: 'busy', run: busy }), { reason: 'busy', message: 'busy', run: busy }],
      [err(412, { error: 'not approved', setup: 'not-approved', command: 'specboard init' }), { reason: 'not-approved', message: 'not approved' }],
      [err(503, { error: 'login', claude: 'logged-out' }), { reason: 'logged-out', message: 'login' }],
      [err(503, { error: 'install', claude: 'not-installed' }), { reason: 'not-installed', message: 'install' }],
      [err(503, { error: 'odd' }), { reason: 'error', message: 'odd' }],
      [err(400, { error: 'bad' }), { reason: 'error', message: 'bad' }],
      [new TypeError('Failed to fetch'), { reason: 'offline' }],
      [new Error('weird'), { reason: 'error', message: 'weird' }],
    ];
    for (const [e, want] of cases) {
      mocks.startRun.mockRejectedValueOnce(e);
      let res!: Awaited<ReturnType<typeof result.current.start>>;
      await act(async () => {
        res = await result.current.start('run', 'T-1');
      });
      expect(res).toMatchObject({ ok: false, ...want });
    }
    // a 409 adopts the run that is already going
    expect(result.current.run?.id).toBe('busy');
  });

  it('start succeeds: sends the kind and spec, adopts the run, fires no event', async () => {
    const { result } = await mount(null);
    const seen = vi.fn();
    result.current.onEvent(seen);
    mocks.startRun.mockResolvedValueOnce({ run: run() });
    let res!: Awaited<ReturnType<typeof result.current.start>>;
    await act(async () => {
      res = await result.current.start('run', 'T-1');
    });
    expect(res).toEqual({ ok: true });
    expect(mocks.startRun).toHaveBeenCalledWith('p1', 'run', 'T-1');
    expect(result.current.run?.id).toBe('r1');
    expect(seen).not.toHaveBeenCalled();
  });

  it('start while disconnected returns offline without a request', async () => {
    const { result } = await mount(null, 'disconnected');
    let res!: Awaited<ReturnType<typeof result.current.start>>;
    await act(async () => {
      res = await result.current.start('run', 'T-1');
    });
    expect(res).toMatchObject({ ok: false, reason: 'offline' });
    expect(mocks.startRun).not.toHaveBeenCalled();
  });

  it('stop sends the held run id and takes the returned snapshot', async () => {
    const { result } = await mount(run({ lines: lines(1, 2) }));
    mocks.stopRun.mockResolvedValueOnce({ run: run({ lines: lines(1, 3), status: 'stopped', end: { status: 'stopped' } }) });
    await act(() => result.current.stop());
    expect(mocks.stopRun).toHaveBeenCalledWith('p1', 'r1');
    expect(result.current.run?.status).toBe('stopped');
  });

  it('stop on a run that is gone (404) re-fetches instead of failing', async () => {
    const { result } = await mount(run({ id: 'r5' }));
    mocks.stopRun.mockRejectedValueOnce(err(404, { error: 'Unknown run' }));
    let p!: Promise<void>;
    act(() => {
      p = result.current.stop();
    });
    await waitFor(() => expect(api.getRun).toHaveBeenCalledTimes(2));
    await answer(1, state(null));
    await act(() => p);
    expect(result.current.run).toBeNull();
  });

  it('stop rejects on other failures', async () => {
    const { result } = await mount(run({ id: 'r6' }));
    mocks.stopRun.mockRejectedValueOnce(err(500, { error: 'boom' }));
    await expect(act(() => result.current.stop())).rejects.toThrow('boom');
  });

  it('stop and dismiss do nothing without a run', async () => {
    const { result } = await mount(null);
    await act(() => result.current.stop());
    await act(() => result.current.dismiss());
    expect(mocks.stopRun).not.toHaveBeenCalled();
    expect(mocks.dismissRun).not.toHaveBeenCalled();
  });

  it('dismiss marks the run dismissed', async () => {
    const { result } = await mount(run({ status: 'finished', end: { status: 'finished' } }));
    mocks.dismissRun.mockResolvedValueOnce(undefined);
    await act(() => result.current.dismiss());
    expect(mocks.dismissRun).toHaveBeenCalledWith('p1', 'r1');
    expect(result.current.run?.dismissed).toBe(true);
  });
});

describe('mergeRun', () => {
  it('keeps the held line when a snapshot repeats a seq', () => {
    const held = run({ lines: [{ ...line(1), text: 'held' }] });
    expect(mergeRun(held, run({ lines: [{ ...line(1), text: 'snap' }, line(2)] })).lines.map((l) => l.text)).toEqual(['held', 'line 2']);
  });
});
