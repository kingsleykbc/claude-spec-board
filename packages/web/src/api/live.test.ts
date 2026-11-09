import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { connectLive, type Conn } from './live';

class MockWS {
  static all: MockWS[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  sent: string[] = [];
  closed = false;
  constructor(readonly url: string) {
    MockWS.all.push(this);
  }
  send(s: string) {
    this.sent.push(s);
  }
  close() {
    this.closed = true;
  }
  // test helpers
  open() {
    this.onopen?.();
  }
  fail() {
    this.onerror?.();
    this.onclose?.();
  }
  msg(o: unknown) {
    this.onmessage?.({ data: JSON.stringify(o) });
  }
}
const last = () => MockWS.all[MockWS.all.length - 1]!;

describe('connectLive (Review Focus 5)', () => {
  beforeEach(() => {
    MockWS.all = [];
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', MockWS);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('subscribes on open and calls onChange for its own project only', () => {
    const onChange = vi.fn();
    const conns: Conn[] = [];
    const stop = connectLive('p1', onChange, (c) => conns.push(c));
    expect(last().url).toBe(`ws://${location.host}/ws`);
    last().open();
    expect(conns).toEqual(['live']);
    expect(JSON.parse(last().sent[0]!)).toEqual({ type: 'subscribe', pid: 'p1' });
    expect(onChange.mock.calls).toEqual([[true]]); // the first open is a plain load, not a change
    last().msg({ type: 'hello' });
    last().msg({ type: 'project-changed', pid: 'other' });
    expect(onChange).toHaveBeenCalledTimes(1);
    last().msg({ type: 'project-changed', pid: 'p1' });
    expect(onChange.mock.calls).toEqual([[true], [false]]);
    stop();
  });

  it('passes every other message to onMessage (never project-changed), and calls onOpen after the subscribe', () => {
    const onMessage = vi.fn();
    const onOpen = vi.fn(() => expect(last().sent).toHaveLength(1));
    const stop = connectLive('p1', () => undefined, () => undefined, onMessage, onOpen);
    last().open();
    expect(onOpen).toHaveBeenCalledTimes(1);
    last().msg({ type: 'hello', app: 'specboard' });
    last().msg({ type: 'run-line', runId: 'r1', line: { seq: 1 } });
    last().msg({ type: 'project-changed', pid: 'p1' });
    last().onmessage?.({ data: 'not json' });
    last().onmessage?.({ data: '42' });
    expect(onMessage.mock.calls).toEqual([[{ type: 'hello', app: 'specboard' }], [{ type: 'run-line', runId: 'r1', line: { seq: 1 } }]]);
    last().fail();
    vi.advanceTimersByTime(500);
    last().open();
    expect(onOpen).toHaveBeenCalledTimes(2);
    stop();
  });

  it('live -> reconnecting -> disconnected after 3 failed attempts -> live, with backoff and a refetch on reconnect', () => {
    const onChange = vi.fn();
    const conns: Conn[] = [];
    const stop = connectLive('p1', onChange, (c) => conns.push(c));
    last().open();
    expect(conns).toEqual(['live']);

    last().fail(); // server went away
    expect(conns.at(-1)).toBe('reconnecting');
    expect(MockWS.all).toHaveLength(1);

    vi.advanceTimersByTime(499);
    expect(MockWS.all).toHaveLength(1);
    vi.advanceTimersByTime(1); // 0.5 s
    expect(MockWS.all).toHaveLength(2);
    last().fail(); // failed attempt 1
    expect(conns.at(-1)).toBe('reconnecting');

    vi.advanceTimersByTime(999);
    expect(MockWS.all).toHaveLength(2);
    vi.advanceTimersByTime(1); // 1 s
    expect(MockWS.all).toHaveLength(3);
    last().fail(); // failed attempt 2
    expect(conns.at(-1)).toBe('reconnecting');

    vi.advanceTimersByTime(1999);
    expect(MockWS.all).toHaveLength(3);
    vi.advanceTimersByTime(1); // 2 s
    expect(MockWS.all).toHaveLength(4);
    last().fail(); // failed attempt 3
    expect(conns.at(-1)).toBe('disconnected');

    vi.advanceTimersByTime(3999);
    expect(MockWS.all).toHaveLength(4);
    vi.advanceTimersByTime(1); // then every 4 s
    expect(MockWS.all).toHaveLength(5);
    last().fail();
    expect(conns.at(-1)).toBe('disconnected');
    vi.advanceTimersByTime(4000);
    expect(MockWS.all).toHaveLength(6);

    expect(onChange.mock.calls).toEqual([[true]]); // only the first open so far
    last().open(); // server is back
    expect(conns.at(-1)).toBe('live');
    expect(onChange.mock.calls).toEqual([[true], [false]]); // project re-fetched on reconnect
    expect(JSON.parse(last().sent[0]!)).toEqual({ type: 'subscribe', pid: 'p1' });

    // The backoff starts over after a successful reconnect.
    last().fail();
    expect(conns.at(-1)).toBe('reconnecting');
    vi.advanceTimersByTime(500);
    expect(MockWS.all).toHaveLength(7);
    last().open();
    expect(onChange).toHaveBeenCalledTimes(3);
    stop();
  });

  it('stop() closes the socket and cancels reconnects', () => {
    const conns: Conn[] = [];
    const stop = connectLive('p1', () => undefined, (c) => conns.push(c));
    const ws = last();
    ws.open();
    stop();
    expect(ws.closed).toBe(true);
    ws.onclose?.();
    vi.advanceTimersByTime(10_000);
    expect(MockWS.all).toHaveLength(1);
    expect(conns).toEqual(['live']);
  });

  it('a first connection that never opens counts as a failed attempt', () => {
    const conns: Conn[] = [];
    const stop = connectLive('p1', () => undefined, (c) => conns.push(c));
    last().fail();
    expect(conns).toEqual(['reconnecting']);
    vi.advanceTimersByTime(1000);
    expect(MockWS.all).toHaveLength(2);
    stop();
  });
});
