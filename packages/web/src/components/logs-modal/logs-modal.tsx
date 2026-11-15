import { useMemo, useState } from 'react';
import type { Project } from '@specboard/core';
import { formatLogTime } from '@/lib/format-log-time';
import { formatTokens } from '@/lib/formatTokens';
import { CloseIcon, WarnIcon } from '@/lib/icons';
import { allLogEntries, filterLogs, type LogItem } from '@/state/allLogs';
import { Hint } from '@/components/ui/hint/hint';
import { InfoPopover } from '@/components/ui/info-popover/info-popover';
import { Markdown } from '@/components/ui/markdown/markdown';
import { Modal } from '@/components/ui/modal/modal';

export interface LogsModalProps {
  project: Pick<Project, 'specs' | 'archived'>;
  /** Opens the spec's detail; the caller closes this modal. */
  onOpenSpec: (id: string) => void;
  /** Switches to the Overview. */
  onOpenOverview: () => void;
  onClose: () => void;
  /** For the "time ago" labels; defaults to the current time. */
  now?: Date;
  /** Where focus goes on close if the element that opened it is gone (e.g. the Overview's "View all logs"). */
  returnFocus?: () => HTMLElement | null;
}

/** Every subtask log entry of the project, newest first, with search: the time on the left, the entry on the right. */
export function LogsModal({ project, onOpenSpec, onOpenOverview, onClose, now, returnFocus }: LogsModalProps) {
  const [q, setQ] = useState('');
  const all = useMemo(() => allLogEntries(project), [project]);
  const items = useMemo(() => filterLogs(all, q), [all, q]);
  // Stable row keys: spec, subtask and time, plus a counter for the rare entries that share all three.
  const keys = useMemo(() => {
    const seen = new Map<string, number>();
    const out = new Map<LogItem, string>();
    for (const it of all) {
      const base = `${it.specId}:${it.subtask}:${it.at}`;
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      out.set(it, n ? `${base}#${n}` : base);
    }
    return out;
  }, [all]);
  const at = now ?? new Date();
  const query = q.trim();
  return (
    <Modal label="Logs" width="min(760px, 100%)" onClose={onClose} {...(returnFocus ? { returnFocus } : {})}>
      <div className="flex items-center gap-2 pt-[18px] pr-5 pb-1.5 pl-7">
        <h1 className="m-0 text-[15px] font-semibold tracking-[0.06em]">Logs</h1>
        <span className="flex-1" />
        <button
          type="button"
          className="cursor-pointer rounded-md border-0 bg-transparent px-1.5 py-1 text-[13px] font-semibold text-accent hover:bg-panel"
          onClick={onOpenOverview}
        >
          Open overview
        </button>
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
      <div className="px-7 pt-2 pb-3">
        <input
          type="search"
          className="h-[34px] w-full rounded-lg border border-line2 bg-card px-3 py-0 text-[13.5px] text-fg"
          placeholder="Search logs"
          aria-label="Search logs"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-7 pb-[22px]">
        {all.length === 0 ? (
          <p className="my-7 text-center text-[14px] text-fg2">No logs yet.</p>
        ) : items.length === 0 ? (
          <p className="my-7 text-center text-[14px] text-fg2">No logs match “{query}”.</p>
        ) : (
          <div role="table" aria-label="Log entries" className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 pt-1">
            {items.map((it) => (
              <LogRow key={keys.get(it)} item={it} now={at} onOpenSpec={onOpenSpec} />
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

function LogRow({ item: it, now, onOpenSpec }: { item: LogItem; now: Date; onOpenSpec: (id: string) => void }) {
  const t = formatLogTime(it.at, now);
  return (
    <div role="row" className="col-span-2 grid grid-cols-subgrid">
      <div role="cell" className="leading-5">
        {/* The name starts with the visible label; the tooltip adds the exact time. */}
        <Hint label={t.exact}>
          <time
            tabIndex={0}
            aria-label={t.label === t.exact ? t.exact : `${t.label}, ${t.exact}`}
            {...(t.dateTime ? { dateTime: t.dateTime } : {})}
            className="rounded font-mono text-[12px] whitespace-nowrap text-fg3">
            {t.label}
          </time>
        </Hint>
      </div>
      <div role="cell" className="flex min-w-0 flex-col gap-1">
        <button
          type="button"
          className="cursor-pointer self-start border-0 bg-transparent p-0 text-left text-[13px] leading-5 font-semibold text-fg hover:underline"
          onClick={() => onOpenSpec(it.specId)}
        >
          {`${it.specId} · ${it.specTitle}`}
        </button>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px] text-fg2">
          <span>{`Subtask ${it.subtask} · ${it.subtaskTitle}`}</span>
          {it.tokens !== null && <span className="text-fg3">{formatTokens(it.tokens)} tokens</span>}
          {it.obsolete && (
            // Carries information, so a popover (it opens on touch too) rather than a tooltip.
            <InfoPopover
              label="Obsolete"
              title="Obsolete"
              trigger={
                <span className="flex size-5 items-center justify-center rounded-md text-[14px] text-review-ink hover:bg-review-soft">
                  <WarnIcon aria-hidden />
                </span>
              }
            >
              {it.obsolete.since ? `Since ${it.obsolete.since}: ${it.obsolete.reason}` : it.obsolete.reason}
            </InfoPopover>
          )}
        </div>
        <div className="text-[13.5px] leading-[1.55]">
          <Markdown md={it.text} />
        </div>
      </div>
    </div>
  );
}
