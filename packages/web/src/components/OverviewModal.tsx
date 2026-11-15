import { useId, useState } from 'react';
import type { Project } from '@specboard/core';
import { exportOverview, overviewCounts } from '../lib/exportOverview';
import { formatTokens } from '../lib/formatTokens';
import { CaretIcon, CaretRightIcon, CloseIcon, ErrorIcon, ExportIcon, RefreshIcon } from '../lib/icons';
import { ORDER, relTime, ST } from '../lib/vm';
import { projectTokens } from '../state/allLogs';
import type { PushToast } from '../state/toasts';
import { Spinner } from '@/components/connection-banner/connection-banner';
import { Markdown } from '@/components/ui/markdown/markdown';
import { Modal } from '@/components/ui/modal/modal';
import { TableView } from './table-view/table-view';
import s from './modals.module.css';

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
    ...ORDER.map((k) => ({ key: k, label: ST[k].label, icon: ST[k].icon, ink: ST[k].ink, n: c[k] })),
    { key: 'blocked', label: 'Blocked', icon: ErrorIcon, ink: 'var(--block-ink)', n: c.blocked },
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
      <div className={s.ovScroll}>
        <div className={s.ovHead}>
          <span className={s.ovKicker}>OVERVIEW</span>
          <span className={s.grow} />
          <button type="button" className={s.close} aria-label="Close" onClick={onClose}>
            <CloseIcon aria-hidden />
          </button>
        </div>
        <div className={s.ovTop}>
          <div className={s.ovText}>
            <h1 className={s.ovName}>{name}</h1>
            {project.config?.description && <p className={s.ovDesc}>{project.config.description}</p>}
          </div>
          <div className={s.ovRingWrap}>
            <div className={s.ovRing} style={{ background: `conic-gradient(var(--done) ${deg}deg, var(--line) 0)` }}>
              <div className={s.ovRingIn}>{`${c.done}/${c.total}`}</div>
            </div>
            <span className={s.ovRingLabel}>Complete</span>
          </div>
        </div>
        <div className={s.ovCounts} data-testid="ov-counts">
          {counts.map((x) => (
            <div key={x.key} className={s.ovCount}>
              <span className={s.ovCountIcon} style={{ color: x.ink }}>
                <x.icon aria-hidden />
              </span>
              {x.label}
              <span className={s.ovCountN}>{x.n}</span>
            </div>
          ))}
        </div>
        {tokens > 0 && <div className={s.ovTokens}>Tokens used: {formatTokens(tokens)}</div>}
        <div className={s.ovRule} />
        <div className={s.ovProgress}>
          <div className={s.ovProgHead}>
            <span className={s.ovProgLabel}>SUMMARY</span>
            {onOpenLogs && (
              <button type="button" className={s.ovLink} onClick={onOpenLogs}>
                View all logs
              </button>
            )}
            {updated && <span className={s.ovUpdated}>{updated}</span>}
            <span className={s.grow} />
            <button type="button" className={s.ovRefresh} disabled={refreshing} onClick={onRefresh}>
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
            <div className={s.ovSkeleton}>
              <span className={s.ovSkelText}>Claude is rewriting the summary…</span>
              <div className={s.ovSkelBar} style={{ width: '92%' }} />
              <div className={s.ovSkelBar} style={{ width: '84%' }} />
              <div className={s.ovSkelBar} style={{ width: '60%' }} />
            </div>
          ) : summary ? (
            <div className={s.ovSummary}>
              <Markdown md={summary} />
            </div>
          ) : (
            <div className={s.ovEmpty}>
              <span className={s.ovEmptyText}>No summary yet. Ask Claude to refresh the overview.</span>
              <button type="button" className={s.ovEmptyBtn} onClick={onRefresh}>
                Refresh summary
              </button>
            </div>
          )}
        </div>
        <div className={s.ovTasks}>
          <button type="button" className={s.ovTasksBtn} aria-expanded={tasksOpen} aria-controls={tasksId} onClick={() => setTasksOpen((o) => !o)}>
            {tasksOpen ? <CaretIcon aria-hidden /> : <CaretRightIcon aria-hidden />}
            Tasks
          </button>
          <div id={tasksId} hidden={!tasksOpen}>
            {tasksOpen && <TableView compact specs={project.specs} archived={[]} milestones={project.config?.milestones ?? []} simple={false} />}
          </div>
        </div>
        <div className={s.ovFoot}>
          <button type="button" className={s.ovExport} onClick={onExport}>
            <ExportIcon aria-hidden /> Export .md
          </button>
        </div>
      </div>
    </Modal>
  );
}
