import type { Conn } from '@/api/live';
import { useNarrow } from '@/lib/useNarrow';
import { CaretIcon } from '@/lib/icons';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/connection-banner/connection-banner';
import {
  ResponsiveMenu,
  ResponsiveMenuItem,
  ResponsiveMenuLabel,
  ResponsiveMenuRadioGroup,
  ResponsiveMenuRadioItem,
  ResponsiveMenuSeparator,
} from '@/components/ui/responsive-menu/responsive-menu';

/** A status dot; its colour is a token class. */
const dot = 'size-[7px] flex-none rounded-full';

/** The connection dot's colour and tooltip (shown next to the project name; there is no "Live" text). */
export const LIVE = {
  live: { label: 'Live', color: 'bg-done', title: 'Connected. Watching specs/ for changes.' },
  reconnecting: { label: 'Reconnecting…', color: 'bg-review', title: 'Not connected to the local server' },
  disconnected: { label: 'Disconnected', color: 'bg-block', title: 'Not connected to the local server' },
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
  /** The menu opened (the board reloads the project list then). */
  onOpen?: () => void;
  onPick: (id: string) => void;
  onOpenFolder: () => void;
}

/**
 * Project name button and its menu (prototype lines 39-47): a 300px dropdown on wide screens, a bottom
 * drawer on small ones. Each project shows its folder dot, name, path and progress; a tick marks the current one.
 */
export function ProjectSwitcher({ conn, name, progress, projects, current, onOpen, onPick, onOpenFolder }: ProjectSwitcherProps) {
  const narrow = useNarrow();
  return (
    <ResponsiveMenu
      title="Projects"
      contentClassName="w-[300px]"
      onOpenChange={(open) => {
        if (open) onOpen?.();
      }}
      trigger={
        <button
          type="button"
          className="flex h-8 min-w-0 cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent px-2.5 py-0 text-[14px] font-semibold whitespace-nowrap hover:bg-panel"
        >
          {conn && (
            <span role="img" aria-label={LIVE[conn].label} title={LIVE[conn].title} data-testid="conn" className="inline-flex size-[11px] flex-none items-center justify-center">
              {conn === 'reconnecting' ? <Spinner /> : <span className={cn(dot, LIVE[conn].color)} />}
            </span>
          )}
          <span className="min-w-0 truncate">{name}</span>
          {!narrow && <span className="font-mono text-[11.5px] font-normal text-fg3">{progressText(progress)}</span>}
          <CaretIcon aria-hidden className="text-[13px] text-fg3" />
        </button>
      }
    >
      {/* The drawer is already titled "Projects". */}
      {!narrow && <ResponsiveMenuLabel>PROJECTS</ResponsiveMenuLabel>}
      <ResponsiveMenuRadioGroup value={current} onValueChange={onPick}>
        {projects.map((p) => (
          <ResponsiveMenuRadioItem key={p.id} value={p.id} indicator="check">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="flex items-center gap-[7px] text-[13.5px] font-semibold">
                <span
                  className={cn(dot, p.available === false ? 'bg-fg3' : 'bg-done')}
                  data-testid={`avail-${p.id}`}
                  title={p.available === false ? 'Folder missing' : 'Folder found'}
                />
                {p.name}
              </span>
              <span className="overflow-hidden font-mono text-[11px] text-ellipsis whitespace-nowrap text-fg3" title={p.root}>
                {p.root}
              </span>
            </span>
            <span className="flex-none text-[12px] text-fg2">{progressText(p.progress)}</span>
          </ResponsiveMenuRadioItem>
        ))}
      </ResponsiveMenuRadioGroup>
      <ResponsiveMenuSeparator />
      <ResponsiveMenuItem onSelect={onOpenFolder}>
        <span className="text-fg2">Open another project folder…</span>
      </ResponsiveMenuItem>
    </ResponsiveMenu>
  );
}
