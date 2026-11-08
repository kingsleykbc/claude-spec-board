export type Conn = 'live' | 'reconnecting' | 'disconnected';

/** Delay before the next attempt, indexed by failed attempts so far (then 4 s forever). */
const BACKOFF_MS = [500, 1000, 2000, 4000];
/** Failed attempts in a row before we report `disconnected` (we keep retrying). */
const GIVE_UP_AFTER = 3;

function wsUrl(): string {
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
}

/**
 * Subscribe to `project-changed` events for `pid` over `/ws` (Review Focus 5).
 *
 * Reconnects with backoff 0.5 s, 1 s, 2 s, then every 4 s. Reports `reconnecting` while trying,
 * `disconnected` after the 3rd failed attempt, `live` when open. Every successful reconnect calls
 * `onChange` so the caller re-fetches what it missed. Returns a function that stops everything.
 */
export function connectLive(pid: string, onChange: () => void, onConn: (c: Conn) => void): () => void {
  let ws: WebSocket | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let everOpen = false;
  /** Attempts in a row that closed without ever opening. */
  let fails = 0;
  let last: Conn | null = null;

  const report = (c: Conn) => {
    if (c === last) return;
    last = c;
    onConn(c);
  };

  const schedule = () => {
    const delay = BACKOFF_MS[Math.min(fails, BACKOFF_MS.length - 1)]!;
    timer = setTimeout(() => {
      timer = null;
      connect();
    }, delay);
  };

  function connect(): void {
    if (stopped) return;
    let opened = false;
    const sock = new WebSocket(wsUrl());
    ws = sock;
    sock.onopen = () => {
      if (stopped || ws !== sock) return;
      opened = true;
      const reconnect = everOpen || fails > 0;
      everOpen = true;
      fails = 0;
      sock.send(JSON.stringify({ type: 'subscribe', pid }));
      report('live');
      if (reconnect) onChange();
    };
    sock.onmessage = (e: MessageEvent) => {
      if (stopped || ws !== sock) return;
      let msg: unknown;
      try {
        msg = JSON.parse(String(e.data));
      } catch {
        return;
      }
      const m = msg as { type?: unknown; pid?: unknown } | null;
      if (m && m.type === 'project-changed' && m.pid === pid) onChange();
    };
    sock.onerror = () => undefined; // a close event always follows
    sock.onclose = () => {
      if (stopped || ws !== sock) return;
      ws = null;
      if (!opened) fails += 1;
      report(fails >= GIVE_UP_AFTER ? 'disconnected' : 'reconnecting');
      schedule();
    };
  }

  connect();

  return () => {
    stopped = true;
    if (timer !== null) clearTimeout(timer);
    timer = null;
    const sock = ws;
    ws = null;
    if (sock) {
      sock.onopen = sock.onmessage = sock.onclose = null;
      try {
        sock.close();
      } catch {
        // closing a socket that never connected can throw in some browsers
      }
    }
  };
}
