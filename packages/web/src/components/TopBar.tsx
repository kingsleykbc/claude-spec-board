import type { Conn } from '../api/live';
import { DOCS_PATH } from '../lib/docsPages';
import { BoardIcon, CaretIcon, DocsIcon, MoonIcon, SunIcon, TourIcon } from '../lib/icons';
import type { Theme } from '../lib/theme';
import { Spinner } from './ConnectionBanner';
import { ManualNotice } from './ManualNotice';
import type { ManualReason } from '../state/runUi';
import { ProjectSwitcher, type ProjectSwitcherProps } from './ProjectSwitcher';
import s from './TopBar.module.css';

export const LIVE = {
  live: { label: 'Live', ink: 'var(--fg2)', title: 'Connected. Watching specs/ for changes.' },
  reconnecting: { label: 'Reconnecting…', ink: 'var(--review-ink)', title: 'Not connected to the local server' },
  disconnected: { label: 'Disconnected', ink: 'var(--block-ink)', title: 'Not connected to the local server' },
} as const;

/** The board for a project, or the first one. */
export const boardHref = (project?: string | null): string => (project ? `/?project=${encodeURIComponent(project)}` : '/');
/** The docs, remembering which project you came from so the docs' top bar can show it. */
export const docsHref = (project?: string | null): string => (project ? `${DOCS_PATH}?project=${encodeURIComponent(project)}` : DOCS_PATH);

export interface TopBarProps {
  /** The project switcher; left out while the docs page is still loading the projects. */
  switcher?: ProjectSwitcherProps;
  /** The menu under the logo. */
  brandOpen?: boolean;
  onToggleBrand?: () => void;
  /** 'docs': the documentation page's bar. No References, Overview or Live (they belong to a board), and a link back to it. */
  page?: 'board' | 'docs';
  /** The board's connection; the docs page has none. */
  conn?: Conn;
  theme: Theme;
  onToggleTheme: () => void;
  onOpenRefs?: () => void;
  onOpenOverview?: () => void;
  /** Replays the first-time tour (board only). */
  onTour?: () => void;
  /** Why runs are off here; the board's manual-mode notice shows when set. */
  manual?: ManualReason | null;
}

/** Sticky top bar (prototype lines 32-52), on the board and on the docs page. */
export function TopBar({ switcher, brandOpen = false, onToggleBrand, page = 'board', conn, theme, onToggleTheme, onOpenRefs, onOpenOverview, onTour, manual = null }: TopBarProps) {
  const docs = page === 'docs';
  const project = switcher?.current ?? null;
  const live = conn ? LIVE[conn] : null;
  return (
    <header className={s.bar}>
      <div className={s.sw}>
        <button type="button" className={s.brand} data-tour="brand" aria-haspopup="true" aria-expanded={brandOpen} onClick={onToggleBrand}>
          <span className={s.logo}>
            <span style={{ height: 6, background: 'var(--bg)' }} />
            <span style={{ height: 11, background: 'var(--bg)' }} />
            <span style={{ height: 8, background: 'var(--accent)' }} />
          </span>
          <span className={s.word}>SPEC-BOARD</span>
          <CaretIcon aria-hidden className={s.caret} />
        </button>
        {brandOpen && (
          <div role="menu" className={s.brandMenu}>
            {docs ? (
              <>
                <a role="menuitem" className={s.brandItem} href={boardHref(project)} onClick={onToggleBrand}>
                  <BoardIcon aria-hidden /> Board
                </a>
                <a role="menuitem" aria-current="page" className={s.brandItem} href={docsHref(project)} onClick={onToggleBrand}>
                  <DocsIcon aria-hidden /> Documentation
                </a>
              </>
            ) : (
              <>
                {/* A new tab, so unsaved work on the board is safe. */}
                <a role="menuitem" className={s.brandItem} href={docsHref(project)} target="_blank" rel="noopener" onClick={onToggleBrand}>
                  <DocsIcon aria-hidden /> Documentation
                </a>
                {onTour && (
                  <button
                    type="button"
                    role="menuitem"
                    className={s.brandItem}
                    onClick={() => {
                      onToggleBrand?.();
                      onTour();
                    }}
                  >
                    <TourIcon aria-hidden /> Take the tour
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
      {switcher && (
        <>
          <span className={s.sep} />
          <ProjectSwitcher {...switcher} />
        </>
      )}
      <div className={s.flex} />
      {onOpenRefs && (
        <button type="button" className={s.btn} onClick={onOpenRefs} data-tour="project">
          References
        </button>
      )}
      {onOpenOverview && (
        <button type="button" className={s.btn} onClick={onOpenOverview}>
          Overview
        </button>
      )}
      {docs && (
        <a className={`${s.btn} ${s.linkBtn}`} href={boardHref(project)}>
          <BoardIcon aria-hidden /> Open the board
        </a>
      )}
      {manual && <ManualNotice reason={manual} />}
      {live && (
        <div className={s.live} title={live.title} style={{ color: live.ink }} data-testid="conn">
          {conn === 'reconnecting' && <Spinner />}
          {conn !== 'reconnecting' && <span className={s.dot} style={{ background: conn === 'live' ? 'var(--done)' : 'var(--block)' }} />}
          {live.label}
        </div>
      )}
      <button
        type="button"
        className={s.theme}
        aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        onClick={onToggleTheme}
      >
        {theme === 'dark' ? <SunIcon aria-hidden /> : <MoonIcon aria-hidden />}
      </button>
    </header>
  );
}
