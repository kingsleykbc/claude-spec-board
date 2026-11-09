import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, type ClaudeStatus, type RunEvent, type RunKind, type RunLine, type RunSnapshot } from '../api/client';
import type { LiveMessage } from '../api/live';
import type { LiveChannel } from './useProject';

export type { LiveChannel } from './useProject';

export type StartResult =
  | { ok: true }
  | { ok: false; reason: 'busy' | 'not-approved' | 'logged-out' | 'not-installed' | 'offline' | 'error'; message: string; run?: RunSnapshot; blockedBy?: string; maybeBlockedBy?: string };

export interface UseRun {
  /** The project's current run (running, or ended and not yet dismissed), or null. */
  run: RunSnapshot | null;
  /** Null until the first answer from the server. */
  claude: ClaudeStatus | null;
  approved: boolean;
  start(kind: RunKind, specId?: string): Promise<StartResult>;
  /** Stops the held run. A run that is already gone just refreshes the state; other failures reject. */
  stop(): Promise<void>;
  /** Dismisses the held, ended run. A run that is already gone just refreshes the state; other failures reject. */
  dismiss(): Promise<void>;
  /**
   * Hears run events as they genuinely happen, after they changed the state. `run-started` fires once per run this tab
   * first learns of live: from the socket event or the `start()` response, whichever lands first. `run-ended` fires
   * once when a run held as running ends live: from the socket event or the `stop()` response, whichever lands first.
   * `run-line` fires for each new line. Snapshots (fetches, a reconnect catching up, a run adopted on reload) fire
   * nothing, and neither does a duplicate or dropped event. Each event comes with the run as it stands after that
   * event, which may be ahead of the last render. Returns an unsubscribe function.
   */
  onEvent(handler: (e: RunEvent, run: RunSnapshot) => void): () => void;
}

const isRunning = (r: RunSnapshot) => r.status === 'running';
const lastSeq = (r: RunSnapshot) => r.lines.at(-1)?.seq ?? 0;

/** Lines by `seq`, in order, each seq once (the held one wins). */
function mergeLines(held: RunLine[], incoming: RunLine[]): RunLine[] {
  // The snapshot starts beyond what we hold (we fell far behind, or lines were capped away): its lines replace ours.
  const base = incoming.length > 0 && incoming[0]!.seq > (held.at(-1)?.seq ?? 0) + 1 ? [] : held;
  const bySeq = new Map<number, RunLine>();
  for (const l of incoming) bySeq.set(l.seq, l);
  for (const l of base) bySeq.set(l.seq, l);
  return [...bySeq.values()].sort((a, b) => a.seq - b.seq);
}

/**
 * Folds a snapshot of the run we hold into it without ever moving it backwards: lines merge by `seq`, an ended run
 * stays ended, and a dismissal sticks. A snapshot of an older run than the held one is ignored; a newer one replaces it.
 */
export function mergeRun(held: RunSnapshot | null, snap: RunSnapshot): RunSnapshot {
  if (!held) return snap;
  if (held.id !== snap.id) return snap.startedAt >= held.startedAt ? snap : held;
  const state = !isRunning(held) ? held : snap;
  return { ...state, lines: mergeLines(held.lines, snap.lines), dismissed: held.dismissed || snap.dismissed };
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** What `run`, `claude` and `approved` come from: refs are the truth, state only drives renders. */
interface Held {
  run: RunSnapshot | null;
  claude: ClaudeStatus | null;
  approved: boolean;
}

/**
 * The project's run: fetched from `GET /run` and kept current by the run events on the project's socket (`live`
 * comes from `useProject`; this hook never opens a socket). It fetches on mount, after every socket open (the
 * subscribe has been sent by then, so an end that fired just before it is still seen), and when a `run-line` skips
 * a `seq` or belongs to a run it does not hold.
 */
export function useRun(pid: string, live: LiveChannel): UseRun {
  const [held, setHeld] = useState<Held>({ run: null, claude: null, approved: false });
  const ref = useRef<Held>(held);
  /** Bumped when the project changes: answers started before are ignored. */
  const epoch = useRef(0);
  /** Bumped whenever an event or a response (not a fetch) changes the held run: a fetch that started before it must not clear it. */
  const version = useRef(0);
  const gapFetching = useRef(false);
  const handlers = useRef(new Set<(e: RunEvent, run: RunSnapshot) => void>());
  const connRef = useRef(live.conn);
  connRef.current = live.conn;
  const pidRef = useRef(pid);
  pidRef.current = pid;

  const commit = (next: Held) => {
    ref.current = next;
    setHeld(next);
  };
  const setRun = (run: RunSnapshot | null) => {
    version.current++;
    commit({ ...ref.current, run });
  };
  const fire = (e: RunEvent, run: RunSnapshot) => {
    for (const h of [...handlers.current]) h(e, run);
  };

  /** Fetches the run state and merges it. Never fires events; ignored when the project changed meanwhile. */
  const fetchRun = useCallback(async (): Promise<void> => {
    const mine = epoch.current;
    const v = version.current;
    let res;
    try {
      res = await api.getRun(pidRef.current);
    } catch {
      return; // keep what we have; the next open or gap tries again
    }
    if (mine !== epoch.current) return;
    const cur = ref.current;
    let run = cur.run;
    if (res.run) run = mergeRun(run, res.run);
    else if (v === version.current) run = null; // nothing arrived since the request started: the server has no run
    commit({ run, claude: res.claude, approved: res.approved });
  }, []);

  /** A re-fetch because the stream cannot be trusted: at most one at a time, and never repeated for the same trigger. */
  const refetchForGap = useCallback(() => {
    if (gapFetching.current) return;
    gapFetching.current = true;
    void fetchRun().finally(() => {
      gapFetching.current = false;
    });
  }, [fetchRun]);

  const onMessage = useCallback(
    (msg: LiveMessage) => {
      const e = msg as unknown as RunEvent;
      const cur = ref.current.run;
      if (e.type === 'run-started') {
        if (cur && cur.id === e.run.id) {
          setRun(mergeRun(cur, e.run));
          return;
        }
        if (cur && e.run.startedAt < cur.startedAt) return; // an older run than the one held
        setRun(e.run);
        fire(e, e.run);
      } else if (e.type === 'run-line') {
        if (!cur || cur.id !== e.runId) return refetchForGap();
        if (!isRunning(cur)) return; // a late line of a run that already ended
        const last = lastSeq(cur);
        if (e.line.seq <= last) return; // already have it
        if (e.line.seq > last + 1) return refetchForGap(); // missed some: the snapshot has them
        const next = { ...cur, lines: [...cur.lines, e.line] };
        setRun(next);
        fire(e, next);
      } else if (e.type === 'run-ended') {
        if (!cur || cur.id !== e.run.id) return refetchForGap();
        if (!isRunning(cur)) return; // already ended
        const next = mergeRun(cur, e.run);
        setRun(next);
        fire(e, next);
      }
    },
    [refetchForGap],
  );

  // Project switch: start clean and ignore whatever the previous project still has in flight.
  useEffect(() => {
    epoch.current++;
    version.current = 0;
    gapFetching.current = false;
    commit({ run: null, claude: null, approved: false });
    void fetchRun();
    return () => {
      epoch.current++;
    };
  }, [pid, fetchRun]);

  useEffect(() => {
    const offMessage = live.subscribe(onMessage);
    const offOpen = live.onOpen(() => void fetchRun());
    return () => {
      offMessage();
      offOpen();
    };
  }, [pid, live.subscribe, live.onOpen, onMessage, fetchRun]);

  const start = useCallback(
    async (kind: RunKind, specId?: string): Promise<StartResult> => {
      if (connRef.current === 'disconnected') return { ok: false, reason: 'offline', message: 'Disconnected from the local server.' };
      const mine = epoch.current;
      try {
        const { run } = await api.startRun(pidRef.current, kind, specId);
        if (mine === epoch.current) {
          // The response and the `run-started` event race; whichever lands first is the one that fires.
          const cur = ref.current.run;
          const merged = mergeRun(cur, run);
          setRun(merged);
          if (merged.id === run.id && cur?.id !== run.id) fire({ type: 'run-started', run: merged }, merged);
        }
        return { ok: true };
      } catch (e) {
        if (!(e instanceof ApiError)) {
          // fetch rejects with a TypeError when the server cannot be reached
          return e instanceof TypeError ? { ok: false, reason: 'offline', message: 'Disconnected from the local server.' } : { ok: false, reason: 'error', message: message(e) };
        }
        const body = (e.body ?? {}) as { run?: RunSnapshot; setup?: string; claude?: string; blockedBy?: string; maybeBlockedBy?: string };
        if (e.status === 409 && body.run) {
          if (mine === epoch.current) setRun(mergeRun(ref.current.run, body.run));
          return { ok: false, reason: 'busy', message: e.message, run: body.run };
        }
        if (e.status === 412 && body.setup === 'not-approved') return { ok: false, reason: 'not-approved', message: e.message };
        if (e.status === 503 && (body.claude === 'not-installed' || body.claude === 'logged-out')) {
          return { ok: false, reason: body.claude, message: e.message, ...(body.blockedBy ? { blockedBy: body.blockedBy } : {}), ...(body.maybeBlockedBy ? { maybeBlockedBy: body.maybeBlockedBy } : {}) };
        }
        return { ok: false, reason: 'error', message: e.message };
      }
    },
    [],
  );

  /** Runs `call` against the held run; a 404 means it is gone, so re-fetch instead of failing. */
  const onHeldRun = useCallback(
    async (call: (runId: string) => Promise<void>) => {
      const cur = ref.current.run;
      if (!cur) return;
      try {
        await call(cur.id);
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) {
          await fetchRun();
          return;
        }
        throw e;
      }
    },
    [fetchRun],
  );

  const stop = useCallback(
    () =>
      onHeldRun(async (runId) => {
        const mine = epoch.current;
        const { run } = await api.stopRun(pidRef.current, runId);
        if (!run || mine !== epoch.current) return;
        // If this response carries the end, it is the live end of the run; the `run-ended` event then finds it ended.
        const cur = ref.current.run;
        const merged = mergeRun(cur, run);
        setRun(merged);
        if (cur && cur.id === merged.id && isRunning(cur) && !isRunning(merged)) fire({ type: 'run-ended', run: merged }, merged);
      }),
    [onHeldRun],
  );

  const dismiss = useCallback(
    () =>
      onHeldRun(async (runId) => {
        const mine = epoch.current;
        await api.dismissRun(pidRef.current, runId);
        const cur = ref.current.run;
        if (cur && cur.id === runId && mine === epoch.current) setRun({ ...cur, dismissed: true });
      }),
    [onHeldRun],
  );

  const onEvent = useCallback((handler: (e: RunEvent, run: RunSnapshot) => void) => {
    handlers.current.add(handler);
    return () => void handlers.current.delete(handler);
  }, []);

  return useMemo(
    () => ({ run: held.run, claude: held.claude, approved: held.approved, start, stop, dismiss, onEvent }),
    [held, start, stop, dismiss, onEvent],
  );
}
