import type { Conn } from '../api/live';
import { DOCS_PATH } from '../lib/docsPages';
import type { Theme } from '../lib/theme';
import { Spinner } from './ConnectionBanner';
import { ProjectSwitcher, type ProjectSwitcherProps } from './ProjectSwitcher';
import s from './TopBar.module.css';

export const LIVE = {
  live: { label: 'Live', ink: 'var(--fg2)', title: 'Connected. Watching specs/ for changes.' },
  reconnecting: { label: 'Reconnecting…', ink: 'var(--review-ink)', title: 'Not connected to the local server' },
  disconnected: { label: 'Disconnected', ink: 'var(--block-ink)', title: 'Not connected to the local server' },
} as const;

export interface TopBarProps {
  switcher: ProjectSwitcherProps;
  /** The menu under the logo. */
  brandOpen?: boolean;
  onToggleBrand?: () => void;
  conn: Conn;
  theme: Theme;
  onToggleTheme: () => void;
  onOpenRefs: () => void;
  onOpenOverview: () => void;
}

/** Sticky top bar (prototype lines 32-52). */
export function TopBar({ switcher, brandOpen = false, onToggleBrand, conn, theme, onToggleTheme, onOpenRefs, onOpenOverview }: TopBarProps) {
  const live = LIVE[conn];
  return (
    <header className={s.bar}>
      <div className={s.sw}>
        <button type="button" className={s.brand} aria-haspopup="true" aria-expanded={brandOpen} onClick={onToggleBrand}>
          <span className={s.logo}>
            <span style={{ height: 6, background: 'var(--bg)' }} />
            <span style={{ height: 11, background: 'var(--bg)' }} />
            <span style={{ height: 8, background: 'var(--accent)' }} />
          </span>
          <span className={s.word}>SPEC-BOARD</span>
          <span className={s.caret}>▾</span>
        </button>
        {brandOpen && (
          <div role="menu" className={s.brandMenu}>
            <a role="menuitem" className={s.brandItem} href={DOCS_PATH} target="_blank" rel="noopener" onClick={onToggleBrand}>
              Documentation
            </a>
          </div>
        )}
      </div>
      <span className={s.sep} />
      <ProjectSwitcher {...switcher} />
      <div className={s.flex} />
      <button type="button" className={s.btn} onClick={onOpenRefs}>
        References
      </button>
      <button type="button" className={s.btn} onClick={onOpenOverview}>
        Overview
      </button>
      <div className={s.live} title={live.title} style={{ color: live.ink }} data-testid="conn">
        {conn === 'reconnecting' && <Spinner />}
        {conn !== 'reconnecting' && <span className={s.dot} style={{ background: conn === 'live' ? 'var(--done)' : 'var(--block)' }} />}
        {live.label}
      </div>
      <button
        type="button"
        className={s.theme}
        aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        onClick={onToggleTheme}
      >
        {theme === 'dark' ? '☀' : '☾'}
      </button>
    </header>
  );
}
