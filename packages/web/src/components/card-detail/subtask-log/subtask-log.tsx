import type { SubtaskLog as Log } from '@specboard/core';
import { WarnIcon } from '@/lib/icons';
import { fmtLogTime } from '@/lib/vm';
import { LogMeta } from '@/components/log-meta/log-meta';
import { InfoPopover } from '@/components/ui/info-popover/info-popover';

// The inline log under a subtask row (prototype lines 248-258; pinned behaviour 10). Read only.

/** One line for the logs list: "Obsolete since <date>: <reason>", or "Obsolete: <reason>" without a date. */
export function obsoleteText(o: NonNullable<Log['obsolete']>): string {
  return o.since ? `Obsolete since ${o.since}: ${o.reason}` : `Obsolete: ${o.reason}`;
}

const label = 'text-[11px] font-semibold tracking-[0.08em] text-fg3';
const group = 'flex flex-col items-start gap-1.5';

export function SubtaskLog({ log }: { log: Log }) {
  const entries = log.entries ?? [];
  const files = log.files ?? [];
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
      <LogMeta files={files} commit={log.commit} pr={log.pr} tokens={log.tokens} doneAt={log.doneAt} />
    </div>
  );
}
