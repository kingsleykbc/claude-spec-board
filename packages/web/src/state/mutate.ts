export type HashOp = (hash: string) => Promise<{ hash: string }>;

interface Chain {
  /** Settles when the last queued op for this spec has finished. */
  tail: Promise<void>;
  /** Hash from the last successful op, or the hash the chain started with. */
  hash: string;
  /** Ops queued and not yet finished. */
  pending: number;
}

/**
 * Serialises hash-checked writes per spec (Review Focus 3).
 *
 * Each op runs with the hash returned by the previous op on the same spec; the first op of a
 * chain uses the caller's `initialHash`. Once a spec's queue drains, the next call starts from
 * the caller's hash again (by then the caller has fresh data). Ops for different specs run in
 * parallel. A failed op rejects its own promise only; later ops keep the last good hash.
 *
 * `send(specId, hash)` is the op used when the caller passes none.
 */
export function createMutator(
  send: (specId: string, baseHash: string) => Promise<{ hash: string }>,
): (specId: string, initialHash: string, op?: HashOp) => Promise<void> {
  const chains = new Map<string, Chain>();

  return (specId, initialHash, op) => {
    const run: HashOp = op ?? ((hash) => send(specId, hash));
    let chain = chains.get(specId);
    if (!chain) {
      chain = { tail: Promise.resolve(), hash: initialHash, pending: 0 };
      chains.set(specId, chain);
    }
    const c = chain;
    c.pending += 1;
    const result = c.tail.then(async () => {
      try {
        const { hash } = await run(c.hash);
        c.hash = hash;
      } finally {
        c.pending -= 1;
        if (c.pending === 0 && chains.get(specId) === c) chains.delete(specId);
      }
    });
    c.tail = result.catch(() => undefined);
    return result;
  };
}
