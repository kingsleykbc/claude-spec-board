import { useEffect, useId, useRef, useState } from 'react';
import { api } from '@/api/client';
import { CloseIcon } from '@/lib/icons';
import type { PushToast } from '@/state/toasts';
import { Modal } from '@/components/ui/modal/modal';
import { Hint } from '@/components/ui/hint/hint';
import { Switch } from '@/components/ui/switch/switch';

export interface SettingsModalProps {
  pid: string;
  /** The saved value, from the project. */
  trackTokens: boolean;
  client?: Pick<typeof api, 'setSettings'>;
  toast: PushToast;
  onClose: () => void;
  /** Where focus goes on close when the opener is gone (a logo-menu item): the logo button. */
  returnFocus?: () => HTMLElement | null;
}

/** Project settings. Each switch saves the moment it is toggled; a failed save puts it back. */
export function SettingsModal({ pid, trackTokens, client = api, toast, onClose, returnFocus }: SettingsModalProps) {
  const [on, setOn] = useState(trackTokens);
  const [saving, setSaving] = useState(false);
  const helpId = useId();
  useEffect(() => setOn(trackTokens), [trackTokens]);

  /** Set synchronously, so a second click before the re-render does nothing. */
  const inFlight = useRef(false);

  // While a save is in flight the switch is aria-disabled and ignores clicks, so a quick second click can't
  // race the first. Not the native `disabled`: that would drop keyboard focus off the switch.
  const toggle = async (next: boolean) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setOn(next);
    setSaving(true);
    try {
      const { settings } = await client.setSettings(pid, { trackTokens: next });
      setOn(settings.trackTokens);
    } catch (e) {
      setOn(!next);
      toast('err', 'Could not save the setting', e instanceof Error ? e.message : String(e));
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  return (
    <Modal label="Settings" width="min(520px, 100%)" height="auto" onClose={onClose} returnFocus={returnFocus}>
      <div className="flex items-center pt-[18px] pr-5 pb-1.5 pl-7">
        <h1 className="m-0 text-[15px] font-semibold tracking-[0.06em]">Settings</h1>
        <span className="flex-1" />
        <Hint label="Close">
          <button
            type="button"
            className="flex size-[34px] cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent p-0 text-[18px] text-fg2 hover:bg-panel"
            aria-label="Close"
            onClick={onClose}
          >
            <CloseIcon aria-hidden />
          </button>
        </Hint>
      </div>
      <div className="flex items-center gap-[18px] px-7 pt-3.5 pb-[26px]">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[14px] font-semibold">Track tokens</span>
          <span id={helpId} className="text-[13px] leading-[1.5] text-fg2">
            Record the tokens Claude uses for each subtask in its log. Needs the Spec Board plugin.
          </span>
        </div>
        <Switch
          aria-label="Track tokens"
          aria-describedby={helpId}
          checked={on}
          aria-disabled={saving || undefined}
          className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
          onCheckedChange={(next) => void toggle(next)}
        />
      </div>
    </Modal>
  );
}
