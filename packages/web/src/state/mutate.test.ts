import { describe, expect, it } from 'vitest';
import { createMutator } from './mutate';

const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));
const noSend = async () => ({ hash: 'unused' });

describe('createMutator', () => {
  it('chains ops on one spec, each receiving the hash returned by the previous op (Review Focus 3)', async () => {
    const mutate = createMutator(noSend);
    const seen: string[] = [];
    let n = 0;
    const op = async (hash: string) => {
      seen.push(hash);
      await tick(5);
      n += 1;
      return { hash: `h${n}` };
    };
    // Three clicks in well under 200 ms, all carrying the same (stale) hash from the rendered card.
    await Promise.all([mutate('T-101', 'h0', op), mutate('T-101', 'h0', op), mutate('T-101', 'h0', op)]);
    expect(seen).toEqual(['h0', 'h1', 'h2']);
  });

  it('starts from the caller hash again once a spec queue has drained', async () => {
    const mutate = createMutator(noSend);
    const seen: string[] = [];
    await mutate('T-101', 'a', async (h) => (seen.push(h), { hash: 'b' }));
    await mutate('T-101', 'fresh', async (h) => (seen.push(h), { hash: 'c' }));
    expect(seen).toEqual(['a', 'fresh']);
  });

  it('runs ops on different specs in parallel', async () => {
    const mutate = createMutator(noSend);
    const t0 = Date.now();
    const starts: Record<string, number> = {};
    const ends: Record<string, number> = {};
    const slow = (id: string) => async () => {
      starts[id] = Date.now() - t0;
      await tick(60);
      ends[id] = Date.now() - t0;
      return { hash: id };
    };
    await Promise.all([mutate('T-101', 'x', slow('T-101')), mutate('T-102', 'y', slow('T-102'))]);
    // Each started before the other finished: they overlapped.
    expect(starts['T-102']!).toBeLessThan(ends['T-101']!);
    expect(starts['T-101']!).toBeLessThan(ends['T-102']!);
  });

  it('rejects only the failing op; the next op uses the last good hash', async () => {
    const mutate = createMutator(noSend);
    const seen: string[] = [];
    const ok = (out: string) => async (h: string) => (seen.push(h), { hash: out });
    const fail = async (h: string): Promise<{ hash: string }> => {
      seen.push(h);
      throw new Error('boom');
    };
    const results = await Promise.allSettled([mutate('T-1', 'h0', ok('h1')), mutate('T-1', 'h0', fail), mutate('T-1', 'h0', ok('h2'))]);
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected', 'fulfilled']);
    expect(seen).toEqual(['h0', 'h1', 'h1']);
  });

  it('uses send(specId, hash) when no op is given', async () => {
    const calls: [string, string][] = [];
    const mutate = createMutator(async (id, h) => (calls.push([id, h]), { hash: `${h}+` }));
    await Promise.all([mutate('T-1', 'a'), mutate('T-1', 'a')]);
    expect(calls).toEqual([
      ['T-1', 'a'],
      ['T-1', 'a+'],
    ]);
  });
});
