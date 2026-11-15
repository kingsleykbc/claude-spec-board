import { useRef, useState } from 'react';
import type { Spec } from '@specboard/core';
import { api } from '../api/client';
import { OFFLINE_TOAST } from '../state/actions';
import type { PushToast } from '../state/toasts';
import { CloseIcon, PlayIcon } from '../lib/icons';
import { Modal } from '@/components/ui/modal/modal';
import { useDiscardGuard } from '@/lib/use-discard-guard';
import s from './modals.module.css';

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
  const opacity = t === '' ? 0.45 : 1;
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
      <div className={s.nsHead}>
        <span className={s.nsTitle}>New spec</span>
        <span className={s.nsId}>{nextId}</span>
        <span className={s.grow} />
        <button type="button" className={s.close} aria-label="Close" onClick={requestClose}>
          <CloseIcon aria-hidden />
        </button>
      </div>
      <div className={s.nsBody}>
        <div className={s.nsField}>
          <label className={s.nsLabel} htmlFor="ns-title">
            Title
          </label>
          <input
            id="ns-title"
            className={s.nsInput}
            autoFocus
            placeholder="e.g. Nutrition info per serving"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className={s.nsField}>
          <label className={s.nsLabel} htmlFor="ns-desc">
            Description
          </label>
          <textarea
            id="ns-desc"
            className={s.nsTextarea}
            rows={6}
            placeholder="Describe the idea in plain words. What should it do, and for whom?"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
          <span className={s.nsHint}>Claude can turn this into a full spec with features, open questions and subtasks.</span>
        </div>
      </div>
      <div className={s.nsFoot}>
        <button type="button" className={s.nsCancel} onClick={onClose}>
          Cancel
        </button>
        <span className={s.grow} />
        <button type="button" className={s.nsDraft} disabled={disabled} style={{ opacity }} onClick={() => void add(false)}>
          Add as draft
        </button>
        <button type="button" className={s.nsWrite} disabled={disabled} style={{ opacity }} onClick={() => void add(true)}>
          <PlayIcon aria-hidden className={s.nsPlay} />
          Add &amp; have Claude write it up
        </button>
      </div>
      {dialog}
    </Modal>
  );
}
