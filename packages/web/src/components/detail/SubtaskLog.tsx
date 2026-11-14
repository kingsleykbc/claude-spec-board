import { useState } from 'react';
import type { SubtaskLog as Log } from '@specboard/core';
import { WarnIcon } from '../../lib/icons';
import { formatTokens } from '../../lib/formatTokens';
import { fmtLogTime } from '../../lib/vm';
import { FileLink } from '../../state/fileLinks';
import s from './sections.module.css';

// The inline log under a subtask row (prototype lines 248-258; pinned behaviour 10). Read only.

function isHttpUrl(v: string): boolean {
  try {
    const p = new URL(v).protocol;
    return p === 'http:' || p === 'https:';
  } catch {
    return false;
  }
}

export function obsoleteText(o: NonNullable<Log['obsolete']>): string {
  return o.since ? `Obsolete since ${o.since}: ${o.reason}` : `Obsolete: ${o.reason}`;
}

export function SubtaskLog({ log }: { log: Log }) {
  const [noteOpen, setNoteOpen] = useState(false);
  const entries = log.entries ?? [];
  const files = log.files ?? [];
  const hasMeta = Boolean(log.commit || log.pr || log.doneAt || log.tokens !== null);
  return (
    <div className={s.log} data-testid="subtask-log">
      <div className={s.logCol}>
        <span className={s.logLabel}>LOG · READ ONLY</span>
        {log.obsolete && (
          <div className={s.logGroup}>
            <button
              type="button"
              className={s.obsoleteBtn}
              aria-label="Obsolete"
              title={obsoleteText(log.obsolete)}
              aria-expanded={noteOpen}
              onClick={() => setNoteOpen((v) => !v)}
            >
              <WarnIcon />
            </button>
            {noteOpen && (
              <span role="note" className={s.obsoleteNote}>
                {obsoleteText(log.obsolete)}
              </span>
            )}
          </div>
        )}
        {entries.map((e, i) => (
          <div key={i} className={s.entry}>
            <span className={s.when}>{fmtLogTime(e.at ?? '')}</span>
            <span className={s.entryText}>{e.text}</span>
          </div>
        ))}
      </div>
      <div className={s.logCol}>
        {files.length > 0 && (
          <div className={s.logGroup}>
            <span className={s.logLabel}>FILES CHANGED</span>
            {files.map((f) => (
              <FileLink key={f} path={f} className={s.file} />
            ))}
          </div>
        )}
        {hasMeta && (
          <div className={s.logGroup}>
            {log.commit && <span className={s.logLabel}>COMMIT</span>}
            <div className={s.logMeta} data-testid="log-meta">
              {log.commit && <span className={s.commit}>{log.commit}</span>}
              {log.pr &&
                (isHttpUrl(log.pr) ? (
                  <a className={s.prLink} href={log.pr} target="_blank" rel="noopener noreferrer">
                    PR
                  </a>
                ) : (
                  <span className={s.metaText}>{log.pr}</span>
                ))}
              {log.doneAt && <span className={s.metaText}>Done {fmtLogTime(log.doneAt)}</span>}
              {log.tokens !== null && <span className={s.metaText}>{formatTokens(log.tokens)} tokens</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
