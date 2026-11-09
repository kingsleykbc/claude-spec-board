import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Project, Spec } from '@specboard/core';
import { api, type ProjectData } from '../api/client';
import { connectLive, type Conn, type LiveMessage } from '../api/live';

/** How long a live-changed card or subtask row stays highlighted. */
export const CHANGED_MS = 1800;

export interface LiveDiff {
  /** Spec ids, plus `${id}:${n}` subtask keys, that differ between the two loads. */
  changed: Set<string>;
  /** `${id}:${qid}` keys for questions that were not there before. */
  newQuestions: Set<string>;
}

function allSpecs(p: Project): Map<string, Spec> {
  const m = new Map<string, Spec>();
  for (const s of p.archived) m.set(s.id, s);
  for (const s of p.specs) m.set(s.id, s);
  return m;
}

/** What a live refresh changed: specs whose file hash moved (or are new), their changed subtasks, and new questions. */
export function diffProjects(prev: Project, next: Project): LiveDiff {
  const before = allSpecs(prev);
  const changed = new Set<string>();
  const newQuestions = new Set<string>();
  for (const [id, s] of allSpecs(next)) {
    const old = before.get(id);
    if (!old) {
      // A spec that appears through a live update: its questions are new too.
      changed.add(id);
      for (const q of s.questions) newQuestions.add(`${id}:${q.id}`);
      continue;
    }
    if (old.hash === s.hash && old.archived === s.archived) continue;
    changed.add(id);
    const oldSubs = new Map(old.subtasks.map((t) => [t.n, t]));
    for (const t of s.subtasks) {
      const o = oldSubs.get(t.n);
      if (!o || o.done !== t.done || o.title !== t.title) changed.add(`${id}:${t.n}`);
    }
    const oldQs = new Set(old.questions.map((q) => q.id));
    for (const q of s.questions) if (!oldQs.has(q.id)) newQuestions.add(`${id}:${q.id}`);
  }
  return { changed, newQuestions };
}

/**
 * The project's one socket, shared with `useRun`. `conn` is the connection state; `subscribe` hears every server
 * message except `project-changed` (run events, `hello`); `onOpen` runs after each socket open once the subscribe
 * has been sent (a re-fetch started then cannot miss what follows). Both return an unsubscribe function.
 */
export interface LiveChannel {
  conn: Conn;
  subscribe(handler: (msg: LiveMessage) => void): () => void;
  onOpen(handler: () => void): () => void;
}

export interface UseProject {
  data: ProjectData | null;
  conn: Conn;
  /** The shared socket for `useRun(pid, live)`. */
  live: LiveChannel;
  /** Spec ids and `${id}:${n}` subtask keys changed by the last live refresh; cleared after 1.8 s. */
  changed: Set<string>;
  /** `${id}:${qid}` for questions first seen through a live refresh this session. */
  newQuestions: Set<string>;
  /** Re-fetch now, without highlighting (e.g. after the board's own write). */
  refresh(): Promise<void>;
  /**
   * Put a spec the server just returned from a write into the snapshot now (closes the stale-hash window). It replaces
   * only that spec, never counts as a live change, and a later live load with the same hash does not either.
   */
  applyWrite(spec: Spec): void;
  /** Error from the latest fetch, if it failed. */
  error: Error | null;
  /** Drop the socket and connect again now (the banner's Reconnect); re-fetches once live. */
  reconnect(): void;
}

const EMPTY = new Set<string>();

/** Load a project and keep it current through `/ws` change events. */
export function useProject(pid: string): UseProject {
  const [data, setData] = useState<ProjectData | null>(null);
  const [conn, setConn] = useState<Conn>('live');
  const [changed, setChanged] = useState<Set<string>>(EMPTY);
  const [newQuestions, setNewQuestions] = useState<Set<string>>(EMPTY);
  const [error, setError] = useState<Error | null>(null);

  const dataRef = useRef<ProjectData | null>(null);
  const seq = useRef(0);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageHandlers = useRef(new Set<(msg: LiveMessage) => void>());
  const openHandlers = useRef(new Set<() => void>());
  const pidRef = useRef(pid);
  pidRef.current = pid;
  /** Bumped by reconnect() to restart the socket. */
  const [attempt, setAttempt] = useState(0);
  const manual = useRef(false);
  /**
   * A live load was started and no load has been applied since. A newer load (e.g. a manual
   * refresh) that supersedes it still highlights, diffing against the last applied snapshot,
   * so the live update's highlights are not lost (Task 7 review, carry-over b).
   */
  const pendingLive = useRef(false);

  const load = useCallback(async (forPid: string, live: boolean) => {
    const mine = ++seq.current;
    if (live) pendingLive.current = true;
    let next: ProjectData;
    try {
      next = await api.project(forPid);
    } catch (e) {
      if (mine === seq.current && forPid === pidRef.current) setError(e as Error);
      return;
    }
    // Drop stale answers: a newer request was started, or the project was switched.
    if (mine !== seq.current || forPid !== pidRef.current) return;
    const prev = dataRef.current;
    const highlight = live || pendingLive.current;
    pendingLive.current = false;
    dataRef.current = next;
    setData(next);
    setError(null);
    if (highlight && prev && prev.entry.id === next.entry.id) {
      const diff = diffProjects(prev.project, next.project);
      if (diff.newQuestions.size > 0) setNewQuestions((s) => new Set([...s, ...diff.newQuestions]));
      if (diff.changed.size > 0) {
        setChanged(diff.changed);
        if (clearTimer.current !== null) clearTimeout(clearTimer.current);
        clearTimer.current = setTimeout(() => {
          clearTimer.current = null;
          setChanged(EMPTY);
        }, CHANGED_MS);
      }
    }
  }, []);

  useEffect(() => {
    dataRef.current = null;
    setData(null);
    setError(null);
    setChanged(EMPTY);
    setNewQuestions(EMPTY);
    setConn('live');
    manual.current = false;
    pendingLive.current = false;
    void load(pid, false);
    return () => {
      seq.current++;
      if (clearTimer.current !== null) clearTimeout(clearTimer.current);
      clearTimer.current = null;
    };
  }, [pid, load]);

  // The live socket; restarted by reconnect().
  useEffect(() => {
    if (manual.current) setConn('reconnecting');
    manual.current = false;
    const stop = connectLive(
      pid,
      // The first open of a socket is a plain load (nothing changed yet); later opens and `project-changed` highlight.
      (initial) => void load(pid, !initial),
      setConn,
      (msg) => {
        for (const h of [...messageHandlers.current]) h(msg);
      },
      () => {
        for (const h of [...openHandlers.current]) h();
      },
    );
    return stop;
  }, [pid, attempt, load]);

  const refresh = useCallback(() => load(pidRef.current, false), [load]);
  const applyWrite = useCallback((written: Spec) => {
    const prev = dataRef.current;
    if (!prev) return;
    const swap = (list: Spec[]) => (list.some((s) => s.id === written.id) ? list.map((s) => (s.id === written.id ? written : s)) : list);
    const specs = swap(prev.project.specs);
    const archived = swap(prev.project.archived);
    if (specs === prev.project.specs && archived === prev.project.archived) return;
    const next = { ...prev, project: { ...prev.project, specs, archived } };
    dataRef.current = next;
    setData(next);
  }, []);
  const subscribe = useCallback((handler: (msg: LiveMessage) => void) => {
    messageHandlers.current.add(handler);
    return () => void messageHandlers.current.delete(handler);
  }, []);
  const onOpen = useCallback((handler: () => void) => {
    openHandlers.current.add(handler);
    return () => void openHandlers.current.delete(handler);
  }, []);
  const live = useMemo<LiveChannel>(() => ({ conn, subscribe, onOpen }), [conn, subscribe, onOpen]);
  const reconnect = useCallback(() => {
    manual.current = true;
    setAttempt((a) => a + 1);
  }, []);

  return { data, conn, live, changed, newQuestions, refresh, applyWrite, error, reconnect };
}
