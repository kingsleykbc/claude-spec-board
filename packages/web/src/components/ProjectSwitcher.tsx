import type { Conn } from '../api/live';
import { useNarrow } from '../lib/useNarrow';
import { CaretIcon, CheckIcon } from '../lib/icons';
import { Spinner } from './ConnectionBanner';
import s from './TopBar.module.css';

/** The connection dot's colour and tooltip (shown next to the project name; there is no "Live" text). */
export const LIVE = {
  live: { label: 'Live', color: 'var(--done)', title: 'Connected. Watching specs/ for changes.' },
  reconnecting: { label: 'Reconnecting…', color: 'var(--review)', title: 'Not connected to the local server' },
  disconnected: { label: 'Disconnected', color: 'var(--block)', title: 'Not connected to the local server' },
} as const;

/** `"<done>/<total> done"`, or `"No specs yet"` (pinned behaviour 16). Archived specs count as done. */
export function progressText(p: { done: number; total: number }): string {
  return p.total ? `${p.done}/${p.total} done` : 'No specs yet';
}

export interface SwitcherProject {
  id: string;
  name: string;
  root: string;
  progress: { done: number; total: number };
  /** The project's `.specboard/` folder was found; false shows a grey dot. */
  available?: boolean;
}

export interface ProjectSwitcherProps {
  /** The board's connection, shown as a dot by the name (not on the docs page). */
  conn?: Conn;
  /** The current project's name and progress, shown on the button. */
  name: string;
  progress: { done: number; total: number };
  projects: SwitcherProject[];
  current: string;
  open: boolean;
  onToggle: () => void;
  onPick: (id: string) => void;
  onOpenFolder: () => void;
}

/** Project name button and its menu (prototype lines 39-47). */
export function ProjectSwitcher({ conn, name, progress, projects, current, open, onToggle, onPick, onOpenFolder }: ProjectSwitcherProps) {
  const narrow = useNarrow();
  return (
    <div className={s.sw}>
      <button type="button" className={s.swBtn} aria-haspopup="true" aria-expanded={open} onClick={onToggle}>
        {conn && (
          <span role="img" aria-label={LIVE[conn].label} title={LIVE[conn].title} data-testid="conn" className={s.conn}>
            {conn === 'reconnecting' ? <Spinner /> : <span className={s.dot} style={{ background: LIVE[conn].color }} />}
          </span>
        )}
        {name}
        {!narrow && <span className={s.swProg}>{progressText(progress)}</span>}
        <CaretIcon aria-hidden className={s.caret} />
      </button>
      {open && (
        <div role="menu" className={s.menu}>
          <div className={s.menuHead}>PROJECTS</div>
          {projects.map((p) => (
            <button key={p.id} type="button" role="menuitemradio" aria-checked={p.id === current} className={s.item} onClick={() => onPick(p.id)}>
              <span className={s.tick}>{p.id === current ? <CheckIcon aria-hidden /> : null}</span>
              <span className={s.itemText}>
                <span className={s.itemName}>
                  <span
                    className={s.dot}
                    data-testid={`avail-${p.id}`}
                    title={p.available === false ? 'Folder missing' : 'Folder found'}
                    style={{ background: p.available === false ? 'var(--fg3)' : 'var(--done)' }}
                  />
                  {p.name}
                </span>
                <span className={s.itemPath} title={p.root}>
                  {p.root}
                </span>
              </span>
              <span className={s.itemProg}>{progressText(p.progress)}</span>
            </button>
          ))}
          <div className={s.rule} />
          <button type="button" role="menuitem" className={s.folder} onClick={onOpenFolder}>
            Open another project folder…
          </button>
        </div>
      )}
    </div>
  );
}
