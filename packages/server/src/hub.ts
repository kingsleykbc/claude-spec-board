import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocket, WebSocketServer } from 'ws';
import { isAllowedRequest } from './security.js';

/** A client this far behind is cut off (it reconnects and reloads the run) rather than letting output pile up in memory. */
const MAX_BUFFERED = 4 * 1024 * 1024;

/** Fan-out of typed JSON messages (`project-changed`, run events) to WebSocket clients at `/ws`. */
export class Hub {
  private readonly wss = new WebSocketServer({ noServer: true, maxPayload: 65536 });
  private readonly subs = new Map<WebSocket, Set<string>>();

  /**
   * @param onSubscribe called when a client subscribes to a project id (lets the owner start watching it)
   */
  constructor(
    private readonly server: Server,
    private readonly port: () => number,
    private readonly onSubscribe: (pid: string) => void,
  ) {
    server.on('upgrade', this.handleUpgrade);
  }

  private readonly handleUpgrade = (req: IncomingMessage, socket: Duplex, head: Buffer): void => {
    // A reset while we answer must never become an uncaught exception.
    socket.on('error', () => undefined);
    try {
      if (!isAllowedRequest(req.headers.host, req.headers.origin, 'GET', this.port(), { upgrade: true })) {
        this.refuse(socket, '403 Forbidden');
        return;
      }
      if ((req.url ?? '').split('?')[0] !== '/ws') {
        // Not ours; leave other upgrade handlers (if any) alone, otherwise refuse.
        if (this.server.listenerCount('upgrade') <= 1) this.refuse(socket, '404 Not Found');
        return;
      }
      this.wss.handleUpgrade(req, socket, head, (ws) => this.accept(ws));
    } catch {
      this.refuse(socket, '400 Bad Request');
    }
  };

  private refuse(socket: Duplex, status: string): void {
    socket.on('error', () => undefined);
    socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
    socket.destroy();
  }

  private accept(ws: WebSocket): void {
    this.subs.set(ws, new Set());
    ws.on('message', (data) => {
      let msg: unknown;
      try {
        msg = JSON.parse(String(data));
      } catch {
        return;
      }
      if (typeof msg === 'object' && msg !== null) {
        const m = msg as Record<string, unknown>;
        if (m.type === 'subscribe' && typeof m.pid === 'string') {
          this.subs.get(ws)?.add(m.pid);
          this.onSubscribe(m.pid);
        }
      }
    });
    ws.on('close', () => this.subs.delete(ws));
    ws.on('error', () => this.subs.delete(ws));
    ws.send(JSON.stringify({ type: 'hello', app: 'specboard' }));
  }

  /** Send one JSON message to every open socket subscribed to `pid`. Never throws; a client that cannot keep up is dropped. */
  send(pid: string, msg: object): void {
    const text = JSON.stringify(msg);
    for (const [ws, pids] of this.subs) {
      if (!pids.has(pid) || ws.readyState !== WebSocket.OPEN) continue;
      try {
        if (ws.bufferedAmount > MAX_BUFFERED) ws.terminate();
        else ws.send(text);
      } catch {
        ws.terminate();
      }
    }
  }

  async close(): Promise<void> {
    this.server.off('upgrade', this.handleUpgrade);
    for (const ws of this.subs.keys()) ws.terminate();
    this.subs.clear();
    await new Promise<void>((resolve) => this.wss.close(() => resolve()));
  }
}
