import type { Status, Urgency } from '@specboard/core';
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
  runBlockedBy?: string | undefined;
  onRun: () => void;
  onStop: () => void;
  onStatus: (s: Status) => void;
  onUrgency: (u: Urgency) => void;
  onAddCategory: (c: string) => void;
  onRemoveCategory: (c: string) => void;
  onClose: () => void;
}

/** Card detail header (pinned behaviour 7; prototype lines 124-157). */
export function DetailHeader(p: DetailHeaderProps) {
  return (
    <div className={s.head}>
      <div className={s.row}>
        <span className={s.id}>{p.id}</span>
        <span className={s.path} title={p.path}>
          {p.path}
        </span>
        <RunButton id={p.id} state={p.runState} runningId={p.runningId ?? null} hold={p.runHold ?? null} blockedBy={p.runBlockedBy} onRun={p.onRun} onStop={p.onStop} />
        <StatusMenu status={p.status} onPick={p.onStatus} />
        <button type="button" className={s.close} aria-label="Close" onClick={p.onClose}>
          ×
        </button>
      </div>
      <h1 className={s.title}>{p.title}</h1>
      <div className={s.meta}>
        <UrgencyControl value={p.urgency} onPick={p.onUrgency} />
        <span className={s.divider} />
        <CategoryEditor categories={p.categories} all={p.allCategories} onAdd={p.onAddCategory} onRemove={p.onRemoveCategory} />
      </div>
    </div>
  );
}
