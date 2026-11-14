import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { Project, Spec } from '@specboard/core';
import type { ProjectData } from '../api/client';

// useProject with the API and socket mocked: the order of live and manual loads (Task 7 carry-over b).

const fetches: { resolve: (d: ProjectData) => void }[] = [];
let onChange: (initial?: boolean) => void = () => undefined;
let onMessage: ((m: { type: string }) => void) | undefined;
let onOpen: (() => void) | undefined;

vi.mock('../api/client', () => ({
  api: {
    project: vi.fn(
      () =>
        new Promise<ProjectData>((resolve) => {
          fetches.push({ resolve });
        }),
    ),
  },
}));
vi.mock('../api/live', () => ({
  connectLive: (_pid: string, change: (initial: boolean) => void, _conn: unknown, message?: typeof onMessage, open?: () => void) => {
    onChange = (initial = false) => change(initial);
    onMessage = message;
    onOpen = open;
    return () => undefined;
  },
}));

const { useProject } = await import('./useProject');

const spec = (id: string, hash: string, extra: Partial<Spec> = {}): Spec =>
  ({ id, hash, archived: false, subtasks: [], questions: [], ...extra }) as unknown as Spec;
const data = (specs: Spec[]): ProjectData => ({
  entry: { id: 'p1', name: 'P', root: '/' },
  project: { root: '/', config: null, overview: null, settings: { trackTokens: true, problems: [] }, specs, archived: [], problems: [] } as Project,
  nextId: 'T-9',
});
const sub = (n: number, done: boolean) => ({ n, title: `S${n}`, done, line: 0, hasLog: false });
const q = (id: string) => ({ id, type: 'text' as const, text: id, options: [], answer: null, required: true, recommendation: null, line: 0 });

const v1 = data([spec('T-1', 'a', { subtasks: [sub(1, false)] })]);
const v2 = data([spec('T-1', 'b', { subtasks: [sub(1, true)], questions: [q('Q1')] }), spec('T-2', 'c', { questions: [q('Q1')] })]);

beforeEach(() => {
  fetches.length = 0;
});
afterEach(cleanup);

async function loaded() {
  const hook = renderHook(() => useProject('p1'));
  await act(async () => fetches[0]!.resolve(v1));
  await waitFor(() => expect(hook.result.current.data).toBe(v1));
  return hook;
}

describe('useProject highlights', () => {
  it('the first open of the socket loads without highlighting, even if the data moved since the first load', async () => {
    const { result } = await loaded();
    act(() => onChange(true));
    await act(async () => fetches[1]!.resolve(v2));
    expect(result.current.data).toBe(v2);
    expect(result.current.changed.size).toBe(0);
    expect(result.current.newQuestions.size).toBe(0);
  });

  it('a live load highlights changes, and new specs’ questions are new', async () => {
    const { result } = await loaded();
    act(() => onChange());
    await act(async () => fetches[1]!.resolve(v2));
    expect([...result.current.changed].sort()).toEqual(['T-1', 'T-1:1', 'T-2']);
    expect([...result.current.newQuestions].sort()).toEqual(['T-1:Q1', 'T-2:Q1']);
  });

  it('a manual refresh alone does not highlight', async () => {
    const { result } = await loaded();
    let p!: Promise<void>;
    act(() => {
      p = result.current.refresh();
    });
    await act(async () => {
      fetches[1]!.resolve(v2);
      await p;
    });
    expect(result.current.data).toBe(v2);
    expect(result.current.changed.size).toBe(0);
    expect(result.current.newQuestions.size).toBe(0);
  });

  it('a manual refresh that supersedes an in-flight live load keeps its highlights', async () => {
    const { result } = await loaded();
    act(() => onChange()); // live load: fetches[1], still pending
    let p!: Promise<void>;
    act(() => {
      p = result.current.refresh(); // fetches[2] supersedes it
    });
    await act(async () => {
      fetches[2]!.resolve(v2);
      await p;
    });
    expect(result.current.data).toBe(v2);
    expect([...result.current.changed].sort()).toEqual(['T-1', 'T-1:1', 'T-2']);
    expect([...result.current.newQuestions].sort()).toEqual(['T-1:Q1', 'T-2:Q1']);
    // The superseded live answer arrives late and is dropped.
    await act(async () => fetches[1]!.resolve(v1));
    expect(result.current.data).toBe(v2);
  });

  it('the pending-live flag is spent by the load that highlights', async () => {
    const { result } = await loaded();
    act(() => onChange());
    await act(async () => fetches[1]!.resolve(v2));
    const v3 = data([spec('T-1', 'z')]);
    let p!: Promise<void>;
    act(() => {
      p = result.current.refresh();
    });
    await act(async () => {
      fetches[2]!.resolve(v3);
      await p;
    });
    // Still the live highlights from v2 (they clear on their own timer), not a diff with v3.
    expect([...result.current.changed].sort()).toEqual(['T-1', 'T-1:1', 'T-2']);
  });
});

describe('useProject applyWrite', () => {
  it('replaces only that spec, without marking it changed, and a later live load with the same hash is not a change', async () => {
    const { result } = await loaded();
    const written = spec('T-1', 'b', { subtasks: [sub(1, true)] });
    act(() => result.current.applyWrite(written));
    const d = result.current.data!;
    expect(d.project.specs).toEqual([written]);
    expect(d.entry).toBe(v1.entry);
    expect(result.current.changed.size).toBe(0);
    // The live re-fetch that follows our own write returns the same file.
    act(() => onChange());
    await act(async () => fetches[1]!.resolve(data([spec('T-1', 'b', { subtasks: [sub(1, true)] })])));
    expect(result.current.changed.size).toBe(0);
    expect(result.current.newQuestions.size).toBe(0);
  });

  it('leaves other specs and unknown ids alone', async () => {
    const t2 = spec('T-2', 'x');
    const start = data([spec('T-1', 'a'), t2]);
    const hook = renderHook(() => useProject('p1'));
    await act(async () => fetches[0]!.resolve(start));
    await waitFor(() => expect(hook.result.current.data).toBe(start));
    act(() => hook.result.current.applyWrite(spec('T-9', 'z')));
    expect(hook.result.current.data).toBe(start);
    const written = spec('T-1', 'b');
    act(() => hook.result.current.applyWrite(written));
    expect(hook.result.current.data!.project.specs[0]).toBe(written);
    expect(hook.result.current.data!.project.specs[1]).toBe(t2);
  });
});

describe('useProject applyWrite against loads in flight', () => {
  it('a write that lands during an in-flight load is not rolled back by it, other specs still update, no highlight for the write', async () => {
    const start = data([spec('T-1', 'a'), spec('T-2', 'x')]);
    const hook = renderHook(() => useProject('p1'));
    await act(async () => fetches[0]!.resolve(start));
    await waitFor(() => expect(hook.result.current.data).toBe(start));
    act(() => onChange()); // a live load, fetches[1], will answer from before the write
    const written = spec('T-1', 'b');
    act(() => hook.result.current.applyWrite(written));
    await act(async () => fetches[1]!.resolve(data([spec('T-1', 'a'), spec('T-2', 'y')])));
    const specs = hook.result.current.data!.project.specs;
    expect(specs[0]).toBe(written);
    expect(specs[1]!.hash).toBe('y');
    expect([...hook.result.current.changed]).toEqual(['T-2']);
  });

  it('two writes with a refresh between them: neither is lost to the loads', async () => {
    const start = data([spec('T-1', 'a'), spec('T-2', 'x')]);
    const hook = renderHook(() => useProject('p1'));
    await act(async () => fetches[0]!.resolve(start));
    await waitFor(() => expect(hook.result.current.data).toBe(start));
    const w1 = spec('T-1', 'b');
    const w2 = spec('T-2', 'y');
    let p1!: Promise<void>;
    let p2!: Promise<void>;
    act(() => {
      p1 = hook.result.current.refresh(); // fetches[1], started before w1
    });
    act(() => hook.result.current.applyWrite(w1));
    act(() => {
      p2 = hook.result.current.refresh(); // fetches[2], started after w1 and before w2
    });
    act(() => hook.result.current.applyWrite(w2));
    await act(async () => {
      fetches[1]!.resolve(data([spec('T-1', 'a'), spec('T-2', 'x')])); // superseded, dropped
      await p1;
    });
    expect(hook.result.current.data!.project.specs[0]).toBe(w1);
    await act(async () => {
      fetches[2]!.resolve(data([spec('T-1', 'b'), spec('T-2', 'x')])); // has w1, not w2
      await p2;
    });
    const specs = hook.result.current.data!.project.specs;
    expect(specs.map((x) => x.hash)).toEqual(['b', 'y']);
    expect(specs[1]).toBe(w2);
    expect(hook.result.current.changed.size).toBe(0);
    // With nothing in flight the log is spent: a later load is taken as it is.
    let p3!: Promise<void>;
    act(() => {
      p3 = hook.result.current.refresh();
    });
    await act(async () => {
      fetches[3]!.resolve(data([spec('T-1', 'c'), spec('T-2', 'z')]));
      await p3;
    });
    expect(hook.result.current.data!.project.specs.map((x) => x.hash)).toEqual(['c', 'z']);
  });
});

describe('useProject live channel', () => {
  it('relays socket messages and opens to subscribers until they unsubscribe', async () => {
    const { result } = await loaded();
    const seen: string[] = [];
    const offMsg = result.current.live.subscribe((m) => seen.push(m.type));
    const offOpen = result.current.live.onOpen(() => seen.push('open'));
    act(() => {
      onMessage?.({ type: 'run-line' });
      onOpen?.();
    });
    expect(seen).toEqual(['run-line', 'open']);
    offMsg();
    offOpen();
    act(() => {
      onMessage?.({ type: 'run-line' });
      onOpen?.();
    });
    expect(seen).toHaveLength(2);
    expect(result.current.live.conn).toBe(result.current.conn);
  });
});
