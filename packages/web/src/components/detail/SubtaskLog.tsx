import type { SubtaskLog as Log } from '@specboard/core';
import { fmtLogTime } from '../../lib/vm';
import s from './sections.module.css';

// The inline log under a subtask row (prototype lines 248-258; pinned behaviour 10). Read only.

export function SubtaskLog({ log }: { log: Log }) {
  const entries = log.entries ?? [];
  const files = log.files ?? [];
  return (
    <div className={s.log} data-testid="subtask-log">
      <div className={s.logCol}>
        <span className={s.logLabel}>LOG · READ ONLY</span>
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
              <span key={f} className={s.file}>
                {f}
              </span>
            ))}
          </div>
        )}
        {log.commit && (
          <div className={s.logGroup}>
            <span className={s.logLabel}>COMMIT</span>
            <span className={s.commit}>{log.commit}</span>
          </div>
        )}
      </div>
    </div>
  );
}
