import { useId } from 'react';
import type { Conn } from '@/api/live';
import { DOCS_PATH } from '@/lib/docsPages';
import { BoardIcon, DocsIcon, LogIcon, OverviewIcon } from '@/lib/icons';
import type { ThemeChoice } from '@/lib/theme';
import { useNarrow } from '@/lib/useNarrow';
import { cn } from '@/lib/utils';
import type { ManualReason } from '@/state/runUi';
import { Hint } from '@/components/ui/hint/hint';
import { Switch } from '@/components/ui/switch/switch';
import { NotConnected } from '@/components/not-connected/not-connected';
import { ProjectSwitcher, type ProjectSwitcherProps } from '@/components/project-switcher/project-switcher';
import { boardHref, LogoMenu } from './logo-menu';

export { boardHref };
/** The docs, remembering which project you came from so the docs' top bar can show it. */
export const docsHref = (project?: string | null): string => (project ? `${DOCS_PATH}?project=${encodeURIComponent(project)}` : DOCS_PATH);

export interface TopBarProps {
  /** The project switcher; left out while the docs page is still loading the projects. */
  switcher?: ProjectSwitcherProps;
  /** Simple mode: References and Overview move from the header into the logo menu (Logs stays). */
  simple?: boolean;
  /** Turns Simple mode on or off: the switch in the header (the logo menu on small screens). Board only. */
  onSimple?: (on: boolean) => void;
  /** 'docs': the documentation page's bar. No References, Overview, Logs or Live (they belong to a board), and a link back to it. */
  page?: 'board' | 'docs';
  /** The board's connection; the docs page has none. */
  conn?: Conn;
  /** Theme ▸ Light / Dark / System in the logo menu. */
  themeChoice: ThemeChoice;
  onThemeChoice: (choice: ThemeChoice) => void;
  onOpenRefs?: () => void;
  onOpenOverview?: () => void;
  onOpenLogs?: () => void;
  /** Replays the first-time tour (board only). */
  onTour?: () => void;
  /** Why Claude can't run here; the not-connected icon shows when set. */
  manual?: ManualReason | null;
  /** "Sync with code" in the logo menu (board only). */
  onSync?: () => void;
  /** A project-wide sync proposal is waiting: "Sync proposal waiting" reopens it. */
  syncWaiting?: boolean;
  onSyncWaiting?: () => void;
  /** "Settings" in the logo menu (board only). */
  onSettings?: () => void;
}

/** A bordered header button (References, Overview, Logs, Open the board). */
const btn =
  'inline-flex h-8 cursor-pointer items-center gap-[7px] rounded-lg border border-line bg-transparent px-3 py-0 text-[13px] font-medium text-fg no-underline hover:bg-panel hover:text-fg';

/**
 * Sticky top bar (prototype lines 32-52), on the board and on the docs page. Left to right: the logo menu,
 * the project switcher, then the not-connected icon, References, Overview, Simple mode and Logs (always last).
 */
export function TopBar({
  switcher,
  simple = false,
  onSimple,
  page = 'board',
  conn,
  themeChoice,
  onThemeChoice,
  onOpenRefs,
  onOpenOverview,
  onOpenLogs,
  onTour,
  manual = null,
  onSync,
  syncWaiting = false,
  onSyncWaiting,
  onSettings,
}: TopBarProps) {
  const docs = page === 'docs';
  const narrow = useNarrow();
  const simpleId = useId();
  /** References and Overview live in the logo menu (Simple mode, or a small screen). */
  const inMenu = narrow || simple;
  const project = switcher?.current ?? null;
  return (
    <header className="sticky top-0 z-30 flex h-[52px] items-center gap-2.5 border-b border-line bg-bg px-5 [@media(max-width:720px)]:gap-1.5 [@media(max-width:720px)]:px-3">
      <LogoMenu
        page={page}
        project={project}
        docsHref={docsHref(project)}
        themeChoice={themeChoice}
        onThemeChoice={onThemeChoice}
        {...(docs
          ? {}
          : {
              onTour,
              onSync,
              syncWaiting,
              onSyncWaiting,
              onSettings,
              ...(inMenu ? { onOpenRefs, onOpenOverview } : {}),
              ...(narrow && onSimple ? { simple, onSimple } : {}),
            })}
      />
      {switcher && (
        <>
          <span className="h-5 w-px bg-line" />
          <ProjectSwitcher conn={conn} {...switcher} />
        </>
      )}
      <div className="flex-1" />
      {!docs && <NotConnected reason={manual} />}
      {!docs && !inMenu && onOpenRefs && (
        <button type="button" className={btn} onClick={onOpenRefs} data-tour="project">
          <DocsIcon aria-hidden />References
        </button>
      )}
      {!docs && !inMenu && onOpenOverview && (
        <button type="button" className={btn} onClick={onOpenOverview}>
          <OverviewIcon aria-hidden />Overview
        </button>
      )}
      {!docs && !narrow && onSimple && (
        <label
          htmlFor={simpleId}
          data-tour="simple"
          title="Show less on the board. Urgency, categories, dependencies and statuses move into the ⋯ menus."
          className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-fg2 select-none"
        >
          <Switch id={simpleId} checked={simple} onCheckedChange={onSimple} />
          Simple mode
        </label>
      )}
      {!docs &&
        onOpenLogs &&
        (narrow ? (
          <Hint label="Logs">
            <button type="button" className={cn(btn, 'w-8 justify-center px-0')} onClick={onOpenLogs} data-header="logs">
              <LogIcon aria-hidden />
            </button>
          </Hint>
        ) : (
          <button type="button" className={btn} onClick={onOpenLogs} data-header="logs">
            <LogIcon aria-hidden />Logs
          </button>
        ))}
      {docs && (
        <a className={btn} href={boardHref(project)}>
          <BoardIcon aria-hidden />Open the board
        </a>
      )}
    </header>
  );
}
