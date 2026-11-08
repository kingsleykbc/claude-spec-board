import s from './TopBar.module.css';

/** `"<done>/<total> done"`, or `"No specs yet"` (pinned behaviour 16). Archived specs count as done. */
export function progressText(p: { done: number; total: number }): string {
  return p.total ? `${p.done}/${p.total} done` : 'No specs yet';
}

export interface SwitcherProject {
  id: string;
  name: string;
  root: string;
  progress: { done: number; total: number };
}

export interface ProjectSwitcherProps {
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
export function ProjectSwitcher({ name, progress, projects, current, open, onToggle, onPick, onOpenFolder }: ProjectSwitcherProps) {
  return (
    <div className={s.sw}>
      <button type="button" className={s.swBtn} aria-haspopup="true" aria-expanded={open} onClick={onToggle}>
        {name}
        <span className={s.swProg}>{progressText(progress)}</span>
        <span className={s.caret}>▾</span>
      </button>
      {open && (
        <div role="menu" className={s.menu}>
          <div className={s.menuHead}>PROJECTS</div>
          {projects.map((p) => (
            <button key={p.id} type="button" role="menuitemradio" aria-checked={p.id === current} className={s.item} onClick={() => onPick(p.id)}>
              <span className={s.tick}>{p.id === current ? '✓' : ''}</span>
              <span className={s.itemText}>
                <span className={s.itemName}>{p.name}</span>
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
