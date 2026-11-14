import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TopBar, type TopBarProps } from './TopBar';

afterEach(cleanup);

const props = (over: Partial<TopBarProps> = {}): TopBarProps => ({
  switcher: { name: 'Box', progress: { done: 0, total: 0 }, projects: [], current: 'p', open: false, onToggle: vi.fn(), onPick: vi.fn(), onOpenFolder: vi.fn() },
  conn: 'live',
  theme: 'light',
  onToggleTheme: vi.fn(),
  onOpenRefs: vi.fn(),
  onOpenOverview: vi.fn(),
  ...over,
});

describe('the menu under the logo', () => {
  it('stays closed until asked', () => {
    const onToggleBrand = vi.fn();
    render(<TopBar {...props({ onToggleBrand })} />);
    expect(screen.queryByRole('menuitem', { name: 'Documentation' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /SPEC-BOARD/ }));
    expect(onToggleBrand).toHaveBeenCalled();
  });

  it('opens the documentation in a new tab, so unsaved work on the board is safe, and closes', () => {
    const onToggleBrand = vi.fn();
    render(<TopBar {...props({ brandOpen: true, onToggleBrand })} />);
    const item = screen.getByRole('menuitem', { name: 'Documentation' });
    expect(item.getAttribute('href')).toBe('/docs?project=p');
    expect(item.getAttribute('target')).toBe('_blank');
    item.addEventListener('click', (e) => e.preventDefault());
    fireEvent.click(item);
    expect(onToggleBrand).toHaveBeenCalled();
  });
});

describe('sync in the logo menu', () => {
  it('"Sync with code" is always there on the board, and closes the menu', () => {
    const onSync = vi.fn();
    const onToggleBrand = vi.fn();
    render(<TopBar {...props({ brandOpen: true, onToggleBrand, onSync })} />);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sync with code' }));
    expect(onSync).toHaveBeenCalled();
    expect(onToggleBrand).toHaveBeenCalled();
    expect(screen.queryByRole('menuitem', { name: /Sync proposal waiting/ })).toBeNull();
  });

  it('"Sync proposal waiting" shows only when a proposal is waiting, and reopens it', () => {
    const onSyncWaiting = vi.fn();
    render(<TopBar {...props({ brandOpen: true, onSync: vi.fn(), onSyncWaiting, syncWaiting: true })} />);
    fireEvent.click(screen.getByRole('menuitem', { name: /Sync proposal waiting/ }));
    expect(onSyncWaiting).toHaveBeenCalled();
  });
});

describe('the top bar on the docs page', () => {
  const docs = (over: Partial<TopBarProps> = {}) => {
    const { conn: _c, onOpenRefs: _r, onOpenOverview: _o, ...rest } = props(over);
    return { ...rest, page: 'docs' as const };
  };

  it('keeps the logo, project and theme, drops References, Overview and Live, and links back to the board', () => {
    render(<TopBar {...docs()} />);
    expect(screen.getByRole('button', { name: /SPEC-BOARD/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Box/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'References' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Overview' })).toBeNull();
    expect(screen.queryByTestId('conn')).toBeNull();
    expect(screen.getByRole('link', { name: 'Open the board' }).getAttribute('href')).toBe('/?project=p');
  });

  it('its logo menu goes to the board, and marks Documentation as this page in this tab', () => {
    render(<TopBar {...docs({ brandOpen: true })} />);
    expect(screen.getByRole('menuitem', { name: 'Board' }).getAttribute('href')).toBe('/?project=p');
    const here = screen.getByRole('menuitem', { name: 'Documentation' });
    expect(here.getAttribute('aria-current')).toBe('page');
    expect(here.getAttribute('target')).toBeNull();
  });

  it('without a project yet: no switcher, and the board link has no project', () => {
    const { switcher: _s, ...rest } = docs();
    render(<TopBar {...rest} />);
    expect(screen.queryByRole('button', { name: /Box/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'Open the board' }).getAttribute('href')).toBe('/');
  });
});

describe('the manual mode notice', () => {
  it('shows before the live dot only when runs are off', () => {
    const { rerender } = render(<TopBar {...props()} />);
    expect(screen.queryByRole('button', { name: 'Manual mode: background runs are off' })).toBeNull();
    rerender(<TopBar {...props({ manual: 'not-installed' })} />);
    const btn = screen.getByRole('button', { name: 'Manual mode: background runs are off' });
    expect(btn.compareDocumentPosition(screen.getByTestId('conn')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('logs and settings', () => {
  it('Logs is a plain header button next to Overview', () => {
    const onOpenLogs = vi.fn();
    render(<TopBar {...props({ onOpenLogs })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Logs' }));
    expect(onOpenLogs).toHaveBeenCalledOnce();
  });
  it('Settings is in the logo menu after the sync items, and closes the menu', () => {
    const onSettings = vi.fn();
    const onToggleBrand = vi.fn();
    render(<TopBar {...props({ brandOpen: true, onToggleBrand, onSettings, onSync: vi.fn() })} />);
    const names = screen.getAllByRole('menuitem').map((m) => m.textContent?.trim());
    expect(names.at(-1)).toBe('Settings');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Settings' }));
    expect(onToggleBrand).toHaveBeenCalled();
    expect(onSettings).toHaveBeenCalledOnce();
  });
});
