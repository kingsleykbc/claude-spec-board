import { useState } from 'react';
import type { Conn } from '../api/live';
import { DOCS_PATH } from '../lib/docsPages';
import { BoardIcon, CaretIcon, DocsIcon, InfoIcon, LogIcon, MoonIcon, ReadIcon, RefreshIcon, SettingsIcon, TourIcon, WarnIcon } from '../lib/icons';
import type { Theme } from '../lib/theme';
import { useNarrow } from '../lib/useNarrow';
import { ManualNotice, ManualPanel } from './ManualNotice';
import type { ManualReason } from '../state/runUi';
import { ProjectSwitcher, type ProjectSwitcherProps } from './ProjectSwitcher';
import s from './TopBar.module.css';

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
  /** Simple mode: References, Overview and Logs move from the header into the logo menu. */
  simple?: boolean;
  /** 'docs': the documentation page's bar. No References, Overview or Live (they belong to a board), and a link back to it. */
  page?: 'board' | 'docs';
  /** The board's connection; the docs page has none. */
  conn?: Conn;
  theme: Theme;
  onToggleTheme: () => void;
  onOpenRefs?: () => void;
  onOpenOverview?: () => void;
  onOpenLogs?: () => void;
  /** Replays the first-time tour (board only). */
  onTour?: () => void;
  /** Why runs are off here; the board's manual-mode notice shows when set. */
  manual?: ManualReason | null;
  /** "Sync with code" in the logo menu (board only). */
  onSync?: () => void;
  /** A project-wide sync proposal is waiting: "Sync proposal waiting" reopens it. */
  syncWaiting?: boolean;
  onSyncWaiting?: () => void;
  /** "Settings" in the logo menu (board only). */
  onSettings?: () => void;
}

/** Sticky top bar (prototype lines 32-52), on the board and on the docs page. */
export function TopBar({
  switcher,
  brandOpen = false,
  onToggleBrand,
  simple = false,
  page = 'board',
  conn,
  theme,
  onToggleTheme,
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
  /** References, Overview and Logs live in the logo menu (Simple mode, or a small screen). */
  const inMenu = narrow || simple;
  const [manualOpen, setManualOpen] = useState(false);
  /** A menu item that closes the menu, then does its thing. */
  const item = (label: string, Icon: typeof TourIcon, act: () => void, dot = false) => (
    <button
      type="button"
      role="menuitem"
      className={s.brandItem}
      onClick={() => {
        onToggleBrand?.();
        act();
      }}
    >
      <Icon aria-hidden /> {label}
      {dot && <span className={s.waitDot} aria-hidden />}
    </button>
  );
  const project = switcher?.current ?? null;
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
                {onTour && item('Take the tour', TourIcon, onTour)}
                {onSync && item('Sync with code', RefreshIcon, onSync)}
                {syncWaiting && onSyncWaiting && item('Sync proposal waiting', WarnIcon, onSyncWaiting, true)}
                {onSettings && item('Settings', SettingsIcon, onSettings)}
              </>
            )}
            <div role="separator" className={s.menuRule} />
            {inMenu && !docs && (
              <>
                {onOpenRefs && item('References', DocsIcon, onOpenRefs)}
                {onOpenOverview && item('Overview', ReadIcon, onOpenOverview)}
                {onOpenLogs && item('Logs', LogIcon, onOpenLogs)}
                {narrow && manual && item('Manual mode', InfoIcon, () => setManualOpen(true))}
              </>
            )}
            <button type="button" role="menuitemcheckbox" aria-checked={theme === 'dark'} className={s.brandItem} onClick={onToggleTheme}>
              <MoonIcon aria-hidden /> Dark mode
              <span aria-hidden className={`${s.switch} ${theme === 'dark' ? s.switchOn : ''}`} />
            </button>
          </div>
        )}
      </div>
      {switcher && (
        <>
          <span className={s.sep} />
          <ProjectSwitcher conn={conn} {...switcher} />
        </>
      )}
      <div className={s.flex} />
      {!inMenu && onOpenRefs && (
        <button type="button" className={s.btn} onClick={onOpenRefs} data-tour="project">
          References
        </button>
      )}
      {!inMenu && onOpenOverview && (
        <button type="button" className={s.btn} onClick={onOpenOverview}>
          Overview
        </button>
      )}
      {!inMenu && onOpenLogs && (
        <button type="button" className={s.btn} onClick={onOpenLogs}>
          Logs
        </button>
      )}
      {docs && (
        <a className={`${s.btn} ${s.linkBtn}`} href={boardHref(project)}>
          <BoardIcon aria-hidden /> Open the board
        </a>
      )}
      {manual && !narrow && <ManualNotice reason={manual} />}
      {manual && narrow && manualOpen && (
        <div className={s.manualWrap}>
          <ManualPanel reason={manual} onClose={() => setManualOpen(false)} />
        </div>
      )}
    </header>
  );
}
