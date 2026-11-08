import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const rtClose = vi.fn(async () => {});
let mode: 'attach' | 'watch' | 'close' = 'attach';

vi.mock('../src/app.js', async (orig) => {
  const real = await orig<typeof import('../src/app.js')>();
  return {
    ...real,
    attachRealtime: async () => {
      if (mode === 'attach') throw new Error('attach failed');
      if (mode === 'close') return { watch: async () => {}, close: async () => { throw new Error('rt close failed'); } };
      return { watch: async () => { throw new Error('watch failed'); }, close: rtClose };
    },
  };
});

import { start } from '../src/start.js';

const SAMPLE = path.resolve(import.meta.dirname, '../../../examples/recipe-box');
let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'specboard-fail-'));
  process.env.SPECBOARD_HOME = path.join(tmp, 'home');
  await fs.cp(SAMPLE, path.join(tmp, 'p'), { recursive: true });
  rtClose.mockClear();
});
afterEach(async () => {
  delete process.env.SPECBOARD_HOME;
  await fs.rm(tmp, { recursive: true, force: true });
});

async function freePort(): Promise<number> {
  const s = net.createServer();
  await new Promise<void>((r) => s.listen(0, '127.0.0.1', r));
  const p = (s.address() as net.AddressInfo).port;
  await new Promise((r) => s.close(r));
  return p;
}

async function canListen(port: number): Promise<boolean> {
  const s = net.createServer();
  const ok = await new Promise<boolean>((r) => {
    s.once('error', () => r(false));
    s.listen(port, '127.0.0.1', () => r(true));
  });
  if (ok) await new Promise((r) => s.close(r));
  return ok;
}

describe('start failure after listen', () => {
  it('frees the port when attachRealtime throws', async () => {
    mode = 'attach';
    const port = await freePort();
    await expect(start({ path: path.join(tmp, 'p'), port, open: false })).rejects.toThrow('attach failed');
    expect(await canListen(port)).toBe(true);
  });

  it('closes realtime and frees the port when watch throws', async () => {
    mode = 'watch';
    const port = await freePort();
    await expect(start({ path: path.join(tmp, 'p'), port, open: false })).rejects.toThrow('watch failed');
    expect(rtClose).toHaveBeenCalledTimes(1);
    expect(await canListen(port)).toBe(true);
  });

  it('still frees the port when rt.close rejects on close()', async () => {
    mode = 'close';
    const port = await freePort();
    const s = await start({ path: path.join(tmp, 'p'), port, open: false });
    await expect(s.close()).rejects.toThrow('rt close failed');
    expect(await canListen(port)).toBe(true);
  });
});
