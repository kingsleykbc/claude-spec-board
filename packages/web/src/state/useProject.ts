import { useCallback, useEffect, useRef, useState } from 'react';
import type { Project, Spec } from '@specboard/core';
import { api, type ProjectData } from '../api/client';
import { connectLive, type Conn } from '../api/live';

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
      changed.add(id);
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

export interface UseProject {
  data: ProjectData | null;
  conn: Conn;
  /** Spec ids and `${id}:${n}` subtask keys changed by the last live refresh; cleared after 1.8 s. */
  changed: Set<string>;
  /** `${id}:${qid}` for questions first seen through a live refresh this session. */
  newQuestions: Set<string>;
  /** Re-fetch now, without highlighting (e.g. after the board's own write). */
  refresh(): Promise<void>;
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
  const pidRef = useRef(pid);
  pidRef.current = pid;
  /** Bumped by reconnect() to restart the socket. */
  const [attempt, setAttempt] = useState(0);
  const manual = useRef(false);

  const load = useCallback(async (forPid: string, live: boolean) => {
    const mine = ++seq.current;
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
    dataRef.current = next;
    setData(next);
    setError(null);
    if (live && prev && prev.entry.id === next.entry.id) {
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
    const stop = connectLive(
      pid,
      () => void load(pid, true),
      (c) => {
        setConn(c);
        // A fresh socket does not report its first open as a reconnect, so re-fetch here.
        if (c === 'live' && manual.current) {
          manual.current = false;
          void load(pid, false);
        }
      },
    );
    return stop;
  }, [pid, attempt, load]);

  const refresh = useCallback(() => load(pidRef.current, false), [load]);
  const reconnect = useCallback(() => {
    manual.current = true;
    setAttempt((a) => a + 1);
  }, []);

  return { data, conn, changed, newQuestions, refresh, error, reconnect };
}
