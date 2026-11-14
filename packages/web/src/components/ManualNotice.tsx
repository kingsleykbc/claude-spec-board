import { useState } from 'react';
import { ESC, useEscape } from '../lib/escape';
import { InfoIcon } from '../lib/icons';
import type { ManualReason } from '../state/runUi';
import s from './ManualNotice.module.css';

const REASON: Record<ManualReason, string> = {
  'not-installed': "Claude Code isn't installed on this computer.",
  'not-logged-in': "Claude Code isn't logged in.",
  blocked: 'Claude Code is blocked by a setting.',
  'not-approved': "This project isn't set up for background runs.",
};

/** The explanation panel (with its click-away scrim), shared by the header button and the narrow-screen menu item. Mount it only while open. */
export function ManualPanel({ reason, onClose }: { reason: ManualReason; onClose: () => void }) {
  useEscape(true, onClose, ESC.menu);
  return (
    <>
      <div data-testid="manual-scrim" className={s.scrim} onClick={onClose} />
      <div className={s.panel}>
        <div className={s.title}>Non-agentic mode</div>
        <p className={s.text}>The board can't run Claude for you here, so use the Copy command buttons and paste them into a Claude chat.</p>
        <p className={s.reason}>{REASON[reason]}</p>
        <a className={s.link} href="/docs/running-specs#turn-on-background-runs" target="_blank" rel="noopener">
          How to turn on background runs
        </a>
      </div>
    </>
  );
}

/** The header's "Manual" button: why the board can't run Claude here, and how to turn that on. Nothing when runs are available. */
export function ManualNotice({ reason }: { reason: ManualReason | null }) {
  const [open, setOpen] = useState(false);
  if (!reason) return null;
  return (
    <div className={s.wrap}>
      <button type="button" className={s.btn} aria-haspopup="true" aria-expanded={open} aria-label="Manual mode: background runs are off" onClick={() => setOpen((o) => !o)}>
        <InfoIcon aria-hidden /> Manual
      </button>
      {open && <ManualPanel reason={reason} onClose={() => setOpen(false)} />}
    </div>
  );
}
