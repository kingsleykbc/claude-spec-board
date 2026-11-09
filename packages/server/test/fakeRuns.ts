import { vi } from 'vitest';
import type { RunManager, RunSnapshot } from '../src/claude/runs.js';
import type { ProjectEntry } from '../src/registry.js';
import { ApprovedPermissions } from '../src/setup.js';

/** A RunManager stand-in whose methods are spies; nothing starts. */
export function fakeRuns(over: Partial<Record<keyof RunManager, unknown>> = {}) {
  const runs = {
    start: vi.fn(async (): Promise<RunSnapshot> => {
      throw new Error('start not expected');
    }),
    stop: vi.fn(async () => {}),
    dismiss: vi.fn(),
    current: vi.fn((): RunSnapshot | null => null),
    projectChanged: vi.fn(async (_entry: ProjectEntry) => {}),
    close: vi.fn(async () => {}),
  };
  return Object.assign(runs, over) as unknown as typeof runs & RunManager;
}

/** An approved-permissions store in a folder that is never the real `~/.specboard`. */
export function tempApproved(dir: string): ApprovedPermissions {
  return new ApprovedPermissions(`${dir}/permissions.json`);
}
