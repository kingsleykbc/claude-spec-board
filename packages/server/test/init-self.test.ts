import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { initCommand } from '../src/setup.js';

// `init` on the real repo, with its first write replaced: if the check ever broke, nothing gets written to the repo.
vi.mock('../src/kit.js', async (original) => ({
  ...(await original<typeof import('../src/kit.js')>()),
  installSkills: async () => {
    throw new Error('init got past the check');
  },
}));

describe('init on Spec Board itself', () => {
  it('refuses, from the real kit location', async () => {
    const repo = path.resolve(import.meta.dirname, '../../..');
    const io = { isTTY: false, confirm: async () => true, log: () => undefined };
    await expect(initCommand({ root: repo, yes: true, forceSkills: false }, io)).rejects.toThrow(/Spec Board's own/);
    await expect(initCommand({ root: path.dirname(repo), yes: true, forceSkills: false }, io)).rejects.toThrow(/Spec Board's own/);
  });
});
