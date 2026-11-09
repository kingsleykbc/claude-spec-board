import type { Spec, Status } from '@specboard/core';
import { api, ConflictError } from '../api/client';
import { ST } from '../lib/vm';
import type { HashOp } from './mutate';
import type { PushToast } from './toasts';

// Board-level spec actions: status moves (hash-checked, through the mutator) and archive.

export type ActionClient = Pick<typeof api, 'setMeta' | 'archive' | 'unarchive'>;
export type Mutate = (specId: string, initialHash: string, op?: HashOp) => Promise<void>;

export interface ActionDeps {
  pid: string;
  client?: ActionClient;
  mutate: Mutate;
  refresh: () => Promise<void>;
  toast: PushToast;
}

/** Shown when an edit is tried while disconnected (pinned behaviour 15). */
export const OFFLINE_TOAST = ['Disconnected from the local server.', 'Edits won’t save until it’s back.'] as const;

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Thrown inside the op of a move queued behind a conflicted one: it is dropped without a request. */
class Superseded extends Error {}

export function createSpecActions({ pid, client = api, mutate, refresh, toast }: ActionDeps) {
  /**
   * Per spec, how many status-move conflicts have been handled (Ruling 15b). A move remembers the
   * count when it is made; if a conflict was handled since, the move was queued behind that
   * conflict and fails silently (no request, no toast, no extra refresh).
   */
  const conflicts = new Map<string, number>();

  return {
    /** Prototype moveSpec (line 613): PATCH meta status with the spec's hash. */
    async move(spec: Spec, status: Status): Promise<void> {
      if (spec.status === status) return;
      const id = spec.id;
      const seen = conflicts.get(id) ?? 0;
      const superseded = () => (conflicts.get(id) ?? 0) > seen;
      try {
        await mutate(id, spec.hash, (hash) => {
          if (superseded()) throw new Superseded();
          return client.setMeta(pid, id, hash, 'status', status);
        });
      } catch (e) {
        if (e instanceof Superseded || superseded()) return;
        if (e instanceof ConflictError) {
          conflicts.set(id, seen + 1);
          await refresh();
          toast('err', `Couldn’t move ${id}`, 'The file changed. Try again.');
        } else {
          toast('err', `Couldn’t move ${id}`, message(e));
        }
        return;
      }
      await refresh();
      toast('ok', status === 'done' ? `${id} approved` : `${id} moved to ${ST[status].label}`, status === 'done' ? 'Moved to Done.' : spec.title);
    },

    async archive(spec: Spec): Promise<void> {
      try {
        await client.archive(pid, spec.id);
      } catch (e) {
        toast('err', `Couldn’t archive ${spec.id}`, message(e));
        return;
      }
      await refresh();
      toast('ok', `${spec.id} archived`, 'Hidden from the board. Moved to .specboard/archive/.');
    },

    async unarchive(spec: Spec): Promise<void> {
      try {
        await client.unarchive(pid, spec.id);
      } catch (e) {
        toast('err', `Couldn’t unarchive ${spec.id}`, message(e));
        return;
      }
      await refresh();
      toast('ok', `${spec.id} restored`, 'Back on the board.');
    },
  };
}
export type SpecActions = ReturnType<typeof createSpecActions>;
