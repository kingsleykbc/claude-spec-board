import type { SubtaskLog as Log } from '@specboard/core';
import { WarnIcon } from '@/lib/icons';
import { formatTokens } from '@/lib/formatTokens';
import { fmtLogTime } from '@/lib/vm';
import { FileLink } from '@/state/fileLinks';
import { InfoPopover } from '@/components/ui/info-popover/info-popover';

// The inline log under a subtask row (prototype lines 248-258; pinned behaviour 10). Read only.

function isHttpUrl(v: string): boolean {
  try {
    const p = new URL(v).protocol;
    return p === 'http:' || p === 'https:';
  } catch {
    return false;
  }
}

/** One line for the logs list: "Obsolete since <date>: <reason>", or "Obsolete: <reason>" without a date. */
export function obsoleteText(o: NonNullable<Log['obsolete']>): string {
  return o.since ? `Obsolete since ${o.since}: ${o.reason}` : `Obsolete: ${o.reason}`;
}

const label = 'text-[11px] font-semibold tracking-[0.08em] text-fg3';
const group = 'flex flex-col items-start gap-1.5';
const metaText = 'text-[12px] text-fg3';

export function SubtaskLog({ log }: { log: Log }) {
  const entries = log.entries ?? [];
  const files = log.files ?? [];
  const hasMeta = Boolean(log.commit || log.pr || log.doneAt || log.tokens !== null);
  return (
    <div
      className="mr-4 mb-3.5 ml-[45px] grid animate-[sbIn_0.2s_ease-out] grid-cols-[minmax(0,1fr)_220px] gap-5 rounded-[10px] border border-line bg-bg px-4 py-3.5"
      data-testid="subtask-log"
    >
      <div className="flex flex-col gap-3">
        <span className={label}>LOG · READ ONLY</span>
        {log.obsolete && (
          <div className={group}>
            {/* Carries information, so a popover (it opens on touch too) rather than a tooltip. */}
            <InfoPopover
              label="Obsolete"
              title="Obsolete"
              trigger={
                <span className="flex size-6 items-center justify-center rounded-md text-[15px] text-review-ink hover:bg-review-soft">
                  <WarnIcon aria-hidden />
                </span>
              }
            >
              {log.obsolete.since ? `Since ${log.obsolete.since}: ${log.obsolete.reason}` : log.obsolete.reason}
            </InfoPopover>
          </div>
        )}
        {entries.map((e, i) => (
          <div key={i} className="flex flex-col gap-[3px]">
            <span className="text-[12px] text-fg3">{fmtLogTime(e.at ?? '')}</span>
            <span className="text-[13.5px] leading-[1.55] text-pretty">{e.text}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3">
        {files.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className={label}>FILES CHANGED</span>
            {files.map((f) => (
              <FileLink key={f} path={f} className="text-[12px] break-all text-fg2" />
            ))}
          </div>
        )}
        {hasMeta && (
          <div className="flex flex-col gap-1.5">
            {log.commit && <span className={label}>COMMIT</span>}
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5" data-testid="log-meta">
              {log.commit && <span className="self-start rounded-[5px] border border-line bg-code px-[7px] py-0.5 font-mono text-[12px]">{log.commit}</span>}
              {log.pr &&
                (isHttpUrl(log.pr) ? (
                  <a className="text-[12px] font-semibold text-accent no-underline hover:text-accent hover:underline" href={log.pr} target="_blank" rel="noopener noreferrer">
                    PR
                  </a>
                ) : (
                  <span className={metaText}>{log.pr}</span>
                ))}
              {log.doneAt && <span className={metaText}>Done {fmtLogTime(log.doneAt)}</span>}
              {log.tokens !== null && <span className={metaText}>{formatTokens(log.tokens)} tokens</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
