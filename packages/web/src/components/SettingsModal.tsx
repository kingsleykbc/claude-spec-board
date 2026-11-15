import { useEffect, useId, useState } from 'react';
import { api } from '../api/client';
import { CloseIcon } from '../lib/icons';
import type { PushToast } from '../state/toasts';
import { Modal } from '@/components/ui/modal/modal';
import s from './settings.module.css';

export interface SettingsModalProps {
  pid: string;
  /** The saved value, from the project. */
  trackTokens: boolean;
  client?: Pick<typeof api, 'setSettings'>;
  toast: PushToast;
  onClose: () => void;
}

/** Project settings. Each switch saves the moment it is toggled; a failed save puts it back. */
export function SettingsModal({ pid, trackTokens, client = api, toast, onClose }: SettingsModalProps) {
  const [on, setOn] = useState(trackTokens);
  const helpId = useId();
  useEffect(() => setOn(trackTokens), [trackTokens]);

  const toggle = async () => {
    const next = !on;
    setOn(next);
    try {
      const { settings } = await client.setSettings(pid, { trackTokens: next });
      setOn(settings.trackTokens);
    } catch (e) {
      setOn(!next);
      toast('err', 'Could not save the setting', e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Modal label="Settings" width="min(520px, 100%)" height="auto" onClose={onClose}>
      <div className={s.head}>
        <h1 className={s.title}>Settings</h1>
        <span className={s.grow} />
        <button type="button" className={s.close} aria-label="Close" onClick={onClose}>
          <CloseIcon aria-hidden />
        </button>
      </div>
      <div className={s.row}>
        <div className={s.text}>
          <span className={s.label}>Track tokens</span>
          <span id={helpId} className={s.help}>
            Record the tokens Claude uses for each subtask in its log. Needs the Spec Board plugin.
          </span>
        </div>
        <button type="button" role="switch" aria-checked={on} aria-label="Track tokens" aria-describedby={helpId} className={s.switch} onClick={() => void toggle()}>
          <span className={s.track} style={{ background: on ? 'var(--accent)' : 'var(--line2)' }}>
            <span className={s.knob} style={{ left: on ? 15 : 2 }} />
          </span>
        </button>
      </div>
    </Modal>
  );
}
