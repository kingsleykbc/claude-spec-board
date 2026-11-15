import { useId, useState } from 'react';
import type { Project } from '@specboard/core';
import { exportOverview, overviewCounts } from '@/lib/exportOverview';
import { formatTokens } from '@/lib/formatTokens';
import { CaretIcon, CaretRightIcon, CloseIcon, ErrorIcon, ExportIcon, RefreshIcon } from '@/lib/icons';
import { ORDER, relTime, ST } from '@/lib/vm';
import { projectTokens } from '@/state/allLogs';
import type { PushToast } from '@/state/toasts';
import { Spinner } from '@/components/connection-banner/connection-banner';
import { Markdown } from '@/components/ui/markdown/markdown';
import { Modal } from '@/components/ui/modal/modal';
import { TableView } from '@/components/table-view/table-view';
import { Hint } from '@/components/ui/hint/hint';

export interface OverviewModalProps {
  project: Project;
  /** The project's display name (config name, or the registry's). */
  name: string;
  toast: PushToast;
  /** A refresh run is in flight. */
  refreshing?: boolean;
  /** Start a refresh run; refusals and the outcome are toasts. */
  onRefresh: () => void;
  /** Switches to the all-logs modal; the link shows when given. */
  onOpenLogs?: () => void;
  onClose: () => void;
  /** Where focus goes on close when the opener is gone (a logo-menu item): the logo button. */
  returnFocus?: () => HTMLElement | null;
  /** For "Last updated"; defaults to the current time. */
  now?: Date;
}

/** Each count's icon colour (the same inks as `ST`). */
const INK: Record<(typeof ORDER)[number], string> = { todo: 'text-fg2', doing: 'text-doing-ink', review: 'text-review-ink', done: 'text-done-ink' };

/** Download `text` as `filename` through a Blob and an `<a download>`. */
function download(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Project overview (pinned behaviour 17; prototype lines 295-319 and 748-751). */
export function OverviewModal({ project, name, toast, refreshing = false, onRefresh, onOpenLogs, onClose, now, returnFocus }: OverviewModalProps) {
  const c = overviewCounts(project);
  const [tasksOpen, setTasksOpen] = useState(false);
  const tasksId = useId();
  const deg = c.total ? Math.round((c.done / c.total) * 360) : 0;
  const counts = [
    ...ORDER.map((k) => ({ key: k, label: ST[k].label, icon: ST[k].icon, ink: INK[k], n: c[k] })),
    { key: 'blocked', label: 'Blocked', icon: ErrorIcon, ink: 'text-block-ink', n: c.blocked },
  ];
  const tokens = project.settings.trackTokens ? projectTokens(project) : 0;
  const summary = project.overview?.summaryMd.trim() ?? '';
  const rel = relTime(project.overview?.updated, now);
  const updated = refreshing ? 'Updating…' : rel ? `Last updated ${rel}` : '';

  const onExport = () => {
    const { filename, text } = exportOverview(project, name);
    download(filename, text);
    toast('ok', 'Exported overview', filename);
  };

  return (
    <Modal label="Overview" width="min(760px, 100%)" height="auto" onClose={onClose} returnFocus={returnFocus}>
      <div className="flex max-h-[calc(100vh-64px)] flex-col overflow-auto">
        <div className="flex items-center pt-[18px] pr-5 pl-7">
          <span className="text-[11.5px] font-semibold tracking-[0.1em] text-fg3">OVERVIEW</span>
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
        <div className="flex items-start gap-7 px-7 pt-1 pb-[22px]">
          <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            <h1 className="m-0 text-[34px] leading-[1.1] font-semibold tracking-[-0.025em]">{name}</h1>
            {project.config?.description && <p className="m-0 max-w-[58ch] text-[15px] leading-[1.6] text-pretty text-fg2">{project.config.description}</p>}
          </div>
          <div className="flex flex-none flex-col items-center gap-1.5">
            <div className="flex size-[88px] items-center justify-center rounded-full" style={{ background: `conic-gradient(var(--done) ${deg}deg, var(--line) 0)` }}>
              <div className="flex size-[72px] items-center justify-center rounded-full bg-card text-[20px] font-semibold tracking-[-0.02em]">{`${c.done}/${c.total}`}</div>
            </div>
            <span className="text-[12px] font-medium text-fg2">Complete</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 px-7 pb-[22px]" data-testid="ov-counts">
          {counts.map((x) => (
            <div key={x.key} className="flex h-8 items-center gap-2 rounded-lg bg-panel px-3 text-[13px]">
              <span className={`inline-flex text-[13px] ${x.ink}`}>
                <x.icon aria-hidden />
              </span>
              {x.label}
              <span className="font-mono font-semibold">{x.n}</span>
            </div>
          ))}
        </div>
        {tokens > 0 && <div className="px-7 pb-4 text-[13px] text-fg2">Tokens used: {formatTokens(tokens)}</div>}
        <div className="mx-7 border-t border-line" />
        <div className="flex flex-col gap-3 px-7 pt-5 pb-2">
          <div className="flex items-center gap-2.5">
            <span className="text-[11.5px] font-semibold tracking-[0.09em] text-fg2">SUMMARY</span>
            {onOpenLogs && (
              <button type="button" className="cursor-pointer rounded-md border-0 bg-transparent px-1.5 py-[3px] text-[12.5px] font-semibold text-accent hover:bg-panel" onClick={onOpenLogs}>
                View all logs
              </button>
            )}
            {updated && <span className="text-[12px] text-fg3">{updated}</span>}
            <span className="flex-1" />
            <button type="button" className="flex h-[30px] cursor-pointer items-center gap-[7px] rounded-[7px] border border-line bg-card px-[11px] py-0 text-[12.5px] font-medium text-fg enabled:hover:border-line2 disabled:cursor-default" disabled={refreshing} onClick={onRefresh}>
              {refreshing && <Spinner />}
              {refreshing ? (
                'Refreshing'
              ) : (
                <>
                  <RefreshIcon aria-hidden /> Refresh
                </>
              )}
            </button>
          </div>
          {refreshing ? (
            <div className="flex flex-col gap-[9px] py-1">
              <span className="text-[13px] text-doing-ink">Claude is rewriting the summary…</span>
              <div className="h-2.5 w-[92%] rounded bg-panel" />
              <div className="h-2.5 w-[84%] rounded bg-panel" />
              <div className="h-2.5 w-[60%] rounded bg-panel" />
            </div>
          ) : summary ? (
            <div className="max-w-[64ch]">
              <Markdown md={summary} />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2.5 rounded-[10px] border border-dashed border-line2 p-[22px] text-center">
              <span className="text-[14px] text-fg2">No summary yet. Ask Claude to refresh the overview.</span>
              <button type="button" className="h-8 cursor-pointer rounded-lg border-0 bg-accent px-3.5 py-0 text-[13px] font-semibold text-accent-fg" onClick={onRefresh}>
                Refresh summary
              </button>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 px-7 pt-1 pb-2">
          <button type="button" className="inline-flex cursor-pointer items-center gap-1.5 self-start rounded-md border-0 bg-transparent px-1.5 py-1 text-[11.5px] font-semibold tracking-[0.09em] text-fg2 uppercase hover:bg-panel" aria-expanded={tasksOpen} aria-controls={tasksId} onClick={() => setTasksOpen((o) => !o)}>
            {tasksOpen ? <CaretIcon aria-hidden /> : <CaretRightIcon aria-hidden />}
            Tasks
          </button>
          <div id={tasksId} hidden={!tasksOpen}>
            {tasksOpen && <TableView compact specs={project.specs} archived={[]} milestones={project.config?.milestones ?? []} simple={false} />}
          </div>
        </div>
        <div className="flex justify-end px-7 pt-4 pb-[22px]">
          <button type="button" className="flex h-[34px] cursor-pointer items-center gap-[7px] rounded-lg border border-line2 bg-card px-3.5 py-0 text-[13px] font-semibold text-fg hover:bg-panel" onClick={onExport}>
            <ExportIcon aria-hidden /> Export .md
          </button>
        </div>
      </div>
    </Modal>
  );
}
