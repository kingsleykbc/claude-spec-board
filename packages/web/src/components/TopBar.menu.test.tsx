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
    expect(screen.queryByRole('button', { name: /Switch to/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'References' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Overview' })).toBeNull();
    expect(screen.queryByTestId('conn')).toBeNull();
    expect(screen.getByRole('link', { name: 'Open the board' }).getAttribute('href')).toBe('/?project=p');
  });

  it('its logo menu has Dark mode after a separator, as on the board', () => {
    const onToggleTheme = vi.fn();
    render(<TopBar {...docs({ brandOpen: true, onToggleTheme })} />);
    expect(screen.getAllByRole('separator')).toHaveLength(1);
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Dark mode' }));
    expect(onToggleTheme).toHaveBeenCalledOnce();
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
  it('shows only when runs are off, after Overview', () => {
    const { rerender } = render(<TopBar {...props()} />);
    expect(screen.queryByRole('button', { name: 'Manual mode: background runs are off' })).toBeNull();
    rerender(<TopBar {...props({ manual: 'not-installed' })} />);
    const btn = screen.getByRole('button', { name: 'Manual mode: background runs are off' });
    expect(screen.getByRole('button', { name: 'Overview' }).compareDocumentPosition(btn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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

describe('the header in Simple mode', () => {
  const simple = (over: Partial<TopBarProps> = {}) =>
    props({ simple: true, brandOpen: true, onToggleBrand: vi.fn(), onSettings: vi.fn(), onSync: vi.fn(), onTour: vi.fn(), onOpenLogs: vi.fn(), ...over });

  it('not Simple mode: References, Overview and Logs are header buttons, and not in the menu', () => {
    render(<TopBar {...simple({ simple: false })} />);
    for (const n of ['References', 'Overview', 'Logs']) {
      expect(screen.getByRole('button', { name: n })).toBeTruthy();
      expect(screen.queryByRole('menuitem', { name: n })).toBeNull();
    }
  });

  it('moves the three into the logo menu after a separator and before Dark mode, and they still open and close the menu', () => {
    const p = simple();
    render(<TopBar {...p} />);
    for (const n of ['References', 'Overview', 'Logs']) expect(screen.queryByRole('button', { name: n })).toBeNull();
    const names = screen.getAllByRole('menuitem').map((m) => m.textContent?.trim());
    expect(names).toEqual(['Documentation', 'Take the tour', 'Sync with code', 'Settings', 'References', 'Overview', 'Logs']);
    expect(screen.getAllByRole('separator')).toHaveLength(1);
    const order = [...screen.getByRole('menu').children].map((c) => c.getAttribute('role'));
    expect(order.slice(-5)).toEqual(['separator', 'menuitem', 'menuitem', 'menuitem', 'menuitemcheckbox']);
    fireEvent.click(screen.getByRole('menuitem', { name: 'References' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Overview' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Logs' }));
    expect(p.onOpenRefs).toHaveBeenCalledOnce();
    expect(p.onOpenOverview).toHaveBeenCalledOnce();
    expect(p.onOpenLogs).toHaveBeenCalledOnce();
    expect(p.onToggleBrand).toHaveBeenCalledTimes(3);
  });

  it('leaves only the manual notice on the right', () => {
    render(<TopBar {...simple({ brandOpen: false, manual: 'not-installed' })} />);
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual([
      expect.stringContaining('SPEC-BOARD'),
      expect.stringContaining('Box'),
      'Manual mode: background runs are off',
    ]);
  });
});

describe('small screens', () => {
  const mockMedia = (narrow: boolean) =>
    vi.stubGlobal(
      'matchMedia',
      vi.fn((q: string) => ({ matches: q.includes('max-width: 720px') ? narrow : false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    );
  afterEach(() => vi.unstubAllGlobals());

  it('wide: References and Overview are header buttons, and the menu does not repeat them', () => {
    mockMedia(false);
    render(<TopBar {...props({ brandOpen: true, manual: 'not-approved', onOpenLogs: vi.fn() })} />);
    expect(screen.getByRole('button', { name: 'References' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Overview' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Manual mode/ })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: 'References' })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: 'Manual mode' })).toBeNull();
  });

  it('narrow: References, Overview, Logs and Manual mode move into the logo menu, and still work', () => {
    mockMedia(true);
    const onOpenRefs = vi.fn();
    const onOpenOverview = vi.fn();
    const onOpenLogs = vi.fn();
    const onToggleBrand = vi.fn();
    render(<TopBar {...props({ brandOpen: true, onToggleBrand, onOpenRefs, onOpenOverview, onOpenLogs, manual: 'not-approved' })} />);
    expect(screen.queryByRole('button', { name: 'References' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Manual mode/ })).toBeNull();
    fireEvent.click(screen.getByRole('menuitem', { name: 'References' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Overview' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Logs' }));
    expect(onOpenRefs).toHaveBeenCalled();
    expect(onOpenOverview).toHaveBeenCalled();
    expect(onOpenLogs).toHaveBeenCalled();
    expect(onToggleBrand).toHaveBeenCalledTimes(3);
  });

  it('narrow: "Manual mode" opens the same explanation', () => {
    mockMedia(true);
    render(<TopBar {...props({ brandOpen: true, onToggleBrand: vi.fn(), manual: 'not-installed' })} />);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Manual mode' }));
    expect(screen.getByText('Non-agentic mode')).toBeTruthy();
    expect(screen.getByText("Claude Code isn't installed on this computer.")).toBeTruthy();
    fireEvent.click(screen.getByTestId('manual-scrim'));
    expect(screen.queryByText('Non-agentic mode')).toBeNull();
  });

  it('narrow: the switcher keeps its dot but drops the progress text', () => {
    mockMedia(true);
    render(<TopBar {...props({ switcher: { ...props().switcher!, progress: { done: 2, total: 5 } } })} />);
    expect(screen.getByTestId('conn')).toBeTruthy();
    expect(screen.queryByText(/2.*5/)).toBeNull();
  });

  it('with no matchMedia at all it behaves as wide', () => {
    vi.stubGlobal('matchMedia', undefined);
    render(<TopBar {...props()} />);
    expect(screen.getByRole('button', { name: 'References' })).toBeTruthy();
  });
});
