import { useRef, useState } from 'react';
import type { Spec } from '@specboard/core';
import { api } from '@/api/client';
import { OFFLINE_TOAST } from '@/state/actions';
import type { PushToast } from '@/state/toasts';
import { PlayIcon } from '@/lib/icons';
import { Modal, ModalClose } from '@/components/ui/modal/modal';
import { useDiscardGuard } from '@/lib/use-discard-guard';
import { cn } from '@/lib/utils';

export interface AddSpecModalProps {
  pid: string;
  /** The ID the new spec will get (`data.nextId`). */
  nextId: string;
  client?: Pick<typeof api, 'createSpec'>;
  toast: PushToast;
  down?: boolean;
  refresh: () => Promise<void>;
  /** "Have Claude write it up" for the new spec (starts a write-up run). */
  onWriteUp: (spec: Spec) => Promise<void>;
  onClose: () => void;
}

export const NO_DESCRIPTION = 'No description yet.';

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** New spec (pinned behaviour 19; prototype lines 369-378 and 777-780). */
export function AddSpecModal({ pid, nextId, client = api, toast, down = false, refresh, onWriteUp, onClose }: AddSpecModalProps) {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);
  /** Set synchronously, so a second click before the re-render does nothing. */
  const inFlight = useRef(false);
  const t = title.trim();
  const disabled = t === '' || busy;
  const faded = t === '' ? 'opacity-45' : '';
  // F3d: typed text counts as unsaved work, so Esc, the scrim and × ask before dropping it.
  const { requestClose, dialog } = useDiscardGuard({
    editing: false,
    dirty: false,
    otherDirty: t !== '' || desc.trim() !== '',
    what: 'this spec',
    onLeave: () => undefined,
    onClose,
  });

  const add = async (write: boolean) => {
    if (disabled || inFlight.current) return;
    if (down) {
      toast('err', ...OFFLINE_TOAST);
      return;
    }
    inFlight.current = true;
    setBusy(true);
    let spec: Spec;
    try {
      ({ spec } = await client.createSpec(pid, { title: t, description: desc.trim() || NO_DESCRIPTION, draft: true }));
    } catch (e) {
      inFlight.current = false;
      setBusy(false);
      toast('err', 'Couldn’t add the spec', message(e));
      return;
    }
    onClose();
    // The spec exists now: a failed refresh must not swallow the confirmation or the write-up.
    try {
      await refresh();
    } catch {
      // the live update or the next refresh will catch up
    }
    if (write) await onWriteUp(spec);
    else toast('ok', `${spec.id} added as draft`, spec.title);
  };

  return (
    <Modal label="New spec" width="min(600px, 100%)" height="auto" onClose={requestClose}>
      <ModalClose onClick={requestClose} />
      <div className="flex items-center pt-[18px] pr-[60px] pb-1 pl-7">
        <span className="text-[18px] font-semibold">New spec</span>
        <span className="ml-2.5 font-mono text-[12px] text-fg3">{nextId}</span>
        <span className="flex-1" />
      </div>
      <div className="flex flex-col gap-4 px-7 pt-3 pb-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-[12.5px] font-semibold text-fg2" htmlFor="ns-title">
            Title
          </label>
          <input
            id="ns-title"
            className="h-10 rounded-[9px] border border-line2 bg-card px-3 py-0 text-[15px] text-fg"
            autoFocus
            placeholder="e.g. Nutrition info per serving"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[12.5px] font-semibold text-fg2" htmlFor="ns-desc">
            Description
          </label>
          <textarea
            id="ns-desc"
            className="resize-y rounded-[9px] border border-line2 bg-card px-3 py-2.5 text-[14px] leading-[1.55] text-fg"
            rows={6}
            placeholder="Describe the idea in plain words. What should it do, and for whom?"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
          <span className="text-[12.5px] leading-[1.5] text-fg3">Claude can turn this into a full spec with features, open questions and subtasks.</span>
        </div>
      </div>
      <div className="flex items-center gap-2 px-7 pt-4 pb-[22px]">
        <button type="button" className="h-9 cursor-pointer rounded-lg border-0 bg-transparent px-3 py-0 text-[13.5px] text-fg2 hover:bg-panel" onClick={onClose}>
          Cancel
        </button>
        <span className="flex-1" />
        <button type="button" className={cn('h-9 cursor-pointer rounded-lg border border-line2 bg-card px-3.5 py-0 text-[13.5px] font-semibold text-fg disabled:cursor-default', faded)}
          disabled={disabled} onClick={() => void add(false)}>
          Add as draft
        </button>
        <button type="button" className={cn('flex h-9 cursor-pointer items-center gap-[7px] rounded-lg border-0 bg-accent px-[15px] py-0 text-[13.5px] font-semibold text-accent-fg disabled:cursor-default', faded)}
          disabled={disabled} onClick={() => void add(true)}>
          <PlayIcon aria-hidden className="text-[12px]" />
          Add &amp; have Claude write it up
        </button>
      </div>
      {dialog}
    </Modal>
  );
}
