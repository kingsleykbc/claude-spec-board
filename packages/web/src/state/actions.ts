import type { Spec, Status } from '@specboard/core';
import { api, ConflictError } from '../api/client';
import { ST } from '../lib/vm';
import type { HashOp } from './mutate';
import type { PushToast } from './toasts';

// Board-level spec actions: status moves (hash-checked, through the mutator), archive, and the Claude stub.

export type ActionClient = Pick<typeof api, 'setMeta' | 'archive' | 'unarchive' | 'claude'>;
export type Mutate = (specId: string, initialHash: string, op?: HashOp) => Promise<void>;

export interface ActionDeps {
  pid: string;
  client?: ActionClient;
  mutate: Mutate;
  refresh: () => Promise<void>;
  toast: PushToast;
}

export const CLAUDE_STUB_TOAST = 'Claude actions arrive in the next milestone';

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function createSpecActions({ pid, client = api, mutate, refresh, toast }: ActionDeps) {
  return {
    /** Prototype moveSpec (line 613): PATCH meta status with the spec's hash. */
    async move(spec: Spec, status: Status): Promise<void> {
      if (spec.status === status) return;
      const id = spec.id;
      try {
        await mutate(id, spec.hash, (hash) => client.setMeta(pid, id, hash, 'status', status));
      } catch (e) {
        if (e instanceof ConflictError) {
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
      toast('ok', `${spec.id} archived`, 'Hidden from the board. The file stays in specs/.');
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

    /** M2 stub: the server answers 501. */
    async writeUp(spec: Spec): Promise<void> {
      try {
        await client.claude('write-up', { pid, id: spec.id });
      } catch {
        // the stub toast below is all M2 shows
      }
      toast('info', CLAUDE_STUB_TOAST);
    },
  };
}
export type SpecActions = ReturnType<typeof createSpecActions>;
