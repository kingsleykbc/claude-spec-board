import { useMemo, useState } from 'react';
import type { Project } from '@specboard/core';
import { formatTokens } from '../lib/formatTokens';
import { CloseIcon, WarnIcon } from '../lib/icons';
import { fmtLogTime } from '../lib/vm';
import { allLogEntries, filterLogs, groupByDay } from '../state/allLogs';
import { obsoleteText } from './detail/SubtaskLog';
import { Markdown } from './Markdown';
import { Modal } from './Modal';
import s from './logs.module.css';

export interface LogsModalProps {
  project: Pick<Project, 'specs' | 'archived'>;
  /** Opens the spec's detail; the caller closes this modal. */
  onOpenSpec: (id: string) => void;
  /** Switches to the Overview. */
  onOpenOverview: () => void;
  onClose: () => void;
  /** For the day headings; defaults to the current time. */
  now?: Date;
}

/** Every subtask log entry of the project, newest first, grouped by day, with search. */
export function LogsModal({ project, onOpenSpec, onOpenOverview, onClose, now }: LogsModalProps) {
  const [q, setQ] = useState('');
  const all = useMemo(() => allLogEntries(project), [project]);
  const groups = useMemo(() => groupByDay(filterLogs(all, q), now ?? new Date()), [all, q, now]);
  const query = q.trim();
  return (
    <Modal label="Logs" width="min(760px, 100%)" onClose={onClose}>
      <div className={s.head}>
        <h1 className={s.title}>Logs</h1>
        <span className={s.grow} />
        <button type="button" className={s.link} onClick={onOpenOverview}>
          Open overview
        </button>
        <button type="button" className={s.close} aria-label="Close" onClick={onClose}>
          <CloseIcon aria-hidden />
        </button>
      </div>
      <div className={s.searchRow}>
        <input type="search" className={s.search} placeholder="Search logs" aria-label="Search logs" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className={s.body}>
        {all.length === 0 ? (
          <p className={s.empty}>No logs yet.</p>
        ) : groups.length === 0 ? (
          <p className={s.empty}>No logs match “{query}”.</p>
        ) : (
          groups.map((g) => (
            <section key={g.label} className={s.day}>
              <h2 className={s.dayHead}>{g.label}</h2>
              {g.items.map((it, i) => (
                <div key={i} className={s.entry}>
                  <div className={s.meta}>
                    <span className={s.when}>{fmtLogTime(it.at)}</span>
                    <button type="button" className={s.spec} onClick={() => onOpenSpec(it.specId)}>
                      {it.specId} {it.specTitle}
                    </button>
                    <span className={s.sub}>{`Subtask ${it.subtask} · ${it.subtaskTitle}`}</span>
                    {it.tokens !== null && <span className={s.tokens}>{formatTokens(it.tokens)} tokens</span>}
                    {it.obsolete && <WarnIcon role="img" aria-label="Obsolete" className={s.obsolete} title={obsoleteText(it.obsolete)} />}
                  </div>
                  <div className={s.text}>
                    <Markdown md={it.text} />
                  </div>
                </div>
              ))}
            </section>
          ))
        )}
      </div>
    </Modal>
  );
}
