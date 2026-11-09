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
  project: { root: '/', config: null, overview: null, specs, archived: [], problems: [] } as Project,
  nextId: 'T-9',
});
const sub = (n: number, done: boolean) => ({ n, title: `S${n}`, done, line: 0, hasLog: false });
const q = (id: string) => ({ id, type: 'text' as const, text: id, options: [], answer: null, line: 0 });

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
