import type { Conn } from '@/api/live';
import { useNarrow } from '@/lib/useNarrow';
import { CaretIcon, CheckIcon } from '@/lib/icons';
import { Spinner } from '@/components/connection-banner/connection-banner';
import { cn } from '@/lib/utils';

/** A status dot; its colour comes from `style`. */
const dot = 'size-[7px] flex-none rounded-full';
const rowBase = 'cursor-pointer rounded-[7px] border-0 bg-transparent text-left hover:bg-panel';

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
    <div className="relative min-w-0">
      <button type="button" className="flex h-8 cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent px-2.5 py-0 text-[14px] font-semibold whitespace-nowrap hover:bg-panel [@media(max-width:720px)]:max-w-full" aria-haspopup="true" aria-expanded={open} onClick={onToggle}>
        {conn && (
          <span role="img" aria-label={LIVE[conn].label} title={LIVE[conn].title} data-testid="conn" className="inline-flex size-[11px] flex-none items-center justify-center">
            {conn === 'reconnecting' ? <Spinner /> : <span className={dot} style={{ background: LIVE[conn].color }} />}
          </span>
        )}
        <span className="min-w-0 truncate">{name}</span>
        {!narrow && <span className="font-mono text-[11.5px] font-normal text-fg3">{progressText(progress)}</span>}
        <CaretIcon aria-hidden className="text-[13px] text-fg3" />
      </button>
      {open && (
        <div role="menu" className="absolute top-[38px] left-0 flex w-[300px] flex-col gap-0.5 rounded-xl border border-line bg-card p-1.5 shadow-lg">
          <div className="px-2.5 pt-1.5 pb-1 text-[11px] font-semibold tracking-[0.08em] text-fg3">PROJECTS</div>
          {projects.map((p) => (
            <button key={p.id} type="button" role="menuitemradio" aria-checked={p.id === current} className={cn('grid grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-2 px-2.5 py-2', rowBase)} onClick={() => onPick(p.id)}>
              <span className="inline-flex text-[13px] text-accent-ink">{p.id === current ? <CheckIcon aria-hidden /> : null}</span>
              <span className="flex min-w-0 flex-col">
                <span className="flex items-center gap-[7px] text-[13.5px] font-semibold">
                  <span
                    className={dot}
                    data-testid={`avail-${p.id}`}
                    title={p.available === false ? 'Folder missing' : 'Folder found'}
                    style={{ background: p.available === false ? 'var(--fg3)' : 'var(--done)' }}
                  />
                  {p.name}
                </span>
                <span className="overflow-hidden font-mono text-[11px] text-ellipsis whitespace-nowrap text-fg3" title={p.root}>
                  {p.root}
                </span>
              </span>
              <span className="text-[12px] text-fg2">{progressText(p.progress)}</span>
            </button>
          ))}
          <div className="mx-1.5 my-1 h-px bg-line" />
          <button type="button" role="menuitem" className={cn('py-2 pr-2.5 pl-[34px] text-[13px] text-fg2', rowBase)} onClick={onOpenFolder}>
            Open another project folder…
          </button>
        </div>
      )}
    </div>
  );
}
