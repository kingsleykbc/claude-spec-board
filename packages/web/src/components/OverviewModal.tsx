import { useEffect, useRef, useState } from 'react';
import type { Project } from '@specboard/core';
import { exportOverview, overviewCounts } from '../lib/exportOverview';
import { ORDER, relTime, ST } from '../lib/vm';
import { askClaude } from '../state/actions';
import type { PushToast } from '../state/toasts';
import { Spinner } from './ConnectionBanner';
import { Markdown } from './Markdown';
import { Modal } from './Modal';
import s from './modals.module.css';

export interface OverviewModalProps {
  pid: string;
  project: Project;
  /** The project's display name (config name, or the registry's). */
  name: string;
  toast: PushToast;
  down?: boolean;
  onClose: () => void;
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
export function OverviewModal({ pid, project, name, toast, down = false, onClose, now }: OverviewModalProps) {
  const [refreshing, setRefreshing] = useState(false);
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );

  const c = overviewCounts(project);
  const deg = c.total ? Math.round((c.done / c.total) * 360) : 0;
  const counts = [
    ...ORDER.map((k) => ({ key: k, label: ST[k].label, icon: ST[k].icon, ink: ST[k].ink, n: c[k] })),
    { key: 'blocked', label: 'Blocked', icon: '!', ink: 'var(--block-ink)', n: c.blocked },
  ];
  const summary = project.overview?.summaryMd.trim() ?? '';
  const rel = relTime(project.overview?.updated, now);
  const updated = refreshing ? 'Updating…' : rel ? `Last updated ${rel}` : '';

  const refresh = async () => {
    if (refreshing) return;
    if (!down) setRefreshing(true);
    await askClaude({ toast, isDown: () => down }, 'refresh-overview', { pid }, 'Couldn’t reach Claude');
    if (alive.current) setRefreshing(false);
  };

  const onExport = () => {
    const { filename, text } = exportOverview(project, name);
    download(filename, text);
    toast('ok', 'Exported overview', filename);
  };

  return (
    <Modal label="Overview" width="min(760px, 100%)" height="auto" onClose={onClose}>
      <div className={s.ovScroll}>
        <div className={s.ovHead}>
          <span className={s.ovKicker}>OVERVIEW</span>
          <span className={s.grow} />
          <button type="button" className={s.close} aria-label="Close" onClick={onClose}>
            ×
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
                {x.icon}
              </span>
              {x.label}
              <span className={s.ovCountN}>{x.n}</span>
            </div>
          ))}
        </div>
        <div className={s.ovRule} />
        <div className={s.ovProgress}>
          <div className={s.ovProgHead}>
            <span className={s.ovProgLabel}>PROGRESS</span>
            {updated && <span className={s.ovUpdated}>{updated}</span>}
            <span className={s.grow} />
            <button type="button" className={s.ovRefresh} disabled={refreshing} onClick={() => void refresh()}>
              {refreshing && <Spinner />}
              {refreshing ? 'Refreshing' : '↻ Refresh'}
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
              <button type="button" className={s.ovEmptyBtn} onClick={() => void refresh()}>
                Refresh summary
              </button>
            </div>
          )}
        </div>
        <div className={s.ovFoot}>
          <button type="button" className={s.ovExport} onClick={onExport}>
            ⇪ Export .md
          </button>
        </div>
      </div>
    </Modal>
  );
}
