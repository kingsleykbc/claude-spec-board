import type { ReactNode } from 'react';
import type { Status, Urgency } from '@specboard/core';
import { CloseIcon, MoreIcon, RefreshIcon } from '../../lib/icons';
import { FileLink } from '../../state/fileLinks';
import { CategoryEditor } from './CategoryEditor';
import { RunButton, type RunState } from './RunButton';
import { StatusMenu } from './StatusMenu';
import { UrgencyControl } from './UrgencyControl';
import s from './detail.module.css';

export interface DetailHeaderProps {
  id: string;
  /** Project-relative path of the spec file. */
  path: string;
  title: string;
  status: Status;
  urgency: Urgency;
  categories: string[];
  /** Every category in the project, for suggestions. */
  allCategories: string[];
  runState: RunState;
  runningId?: string | null;
  runHold?: string | null;
  runBlockedNote?: string | undefined;
  runBusyNote?: string | undefined;
  onRun: () => void;
  onStop: () => void;
  /** Sync this spec with the code; off while any run is active, like Run. */
  onSync?: () => void;
  /** A sync proposal for this spec is waiting. */
  syncWaiting?: boolean;
  onSyncWaiting?: () => void;
  onStatus: (s: Status) => void;
  onUrgency: (u: Urgency) => void;
  onAddCategory: (c: string) => void;
  onRemoveCategory: (c: string) => void;
  onClose: () => void;
  /** Simple mode: urgency, categories and `dependencies` sit in a ⋯ menu instead of under the title. */
  simple?: boolean;
  detailsOpen?: boolean;
  onDetails?: (open: boolean) => void;
  dependencies?: ReactNode;
}

const SYNC_TITLE = 'Checks this spec against the code and shows what would change before changing anything.';

/** Card detail header (pinned behaviour 7; prototype lines 124-157). */
export function DetailHeader(p: DetailHeaderProps) {
  const urgency = <UrgencyControl value={p.urgency} onPick={p.onUrgency} />;
  const cats = <CategoryEditor categories={p.categories} all={p.allCategories} onAdd={p.onAddCategory} onRemove={p.onRemoveCategory} />;
  const open = p.detailsOpen ?? false;
  /** A run is active (here or on another spec): Sync waits, like Run. */
  const busy = p.runState === 'running' || p.runState === 'disabled';
  return (
    <div className={s.head}>
      <div className={s.row}>
        <span className={s.id}>{p.id}</span>
        <FileLink path={p.path} className={s.path} />
        <RunButton id={p.id} state={p.runState} runningId={p.runningId ?? null} hold={p.runHold ?? null} blockedNote={p.runBlockedNote} busyNote={p.runBusyNote} onRun={p.onRun} onStop={p.onStop} />
        {p.syncWaiting && p.onSyncWaiting && (
          <button type="button" className={s.syncWaiting} onClick={p.onSyncWaiting}>
            Sync proposal waiting
          </button>
        )}
        {p.onSync && (
          <button
            type="button"
            className={busy ? s.runOff : s.copy}
            disabled={busy}
            title={busy ? undefined : SYNC_TITLE}
            onClick={p.onSync}
          >
            <RefreshIcon aria-hidden />
            Sync
          </button>
        )}
        <StatusMenu status={p.status} onPick={p.onStatus} />
        {p.simple && (
          <div className={s.moreWrap}>
            {open && <div className={s.statusScrim} data-testid="details-scrim" onClick={() => p.onDetails?.(false)} />}
            <button
              type="button"
              className={s.moreBtn}
              aria-label="More details"
              aria-haspopup="dialog"
              aria-expanded={open}
              onClick={() => p.onDetails?.(!open)}
            >
              <MoreIcon aria-hidden />
            </button>
            {open && (
              <div role="dialog" aria-label="More details" className={s.moreMenu}>
                <span className={s.moreLabel}>URGENCY</span>
                {urgency}
                <span className={s.moreLabel}>CATEGORIES</span>
                {cats}
                <span className={s.moreLabel}>DEPENDENCIES</span>
                {p.dependencies}
              </div>
            )}
          </div>
        )}
        <button type="button" className={s.close} aria-label="Close" onClick={p.onClose}>
          <CloseIcon aria-hidden />
        </button>
      </div>
      <h1 className={s.title}>{p.title}</h1>
      {!p.simple && (
        <div className={s.meta}>
          {urgency}
          <span className={s.divider} />
          {cats}
        </div>
      )}
    </div>
  );
}
