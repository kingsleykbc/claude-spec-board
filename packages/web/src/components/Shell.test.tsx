import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TopBar, type TopBarProps } from './TopBar';
import { ConnectionBanner } from './ConnectionBanner';
import { FilterBar, type FilterBarProps } from './FilterBar';
import { progressText } from './ProjectSwitcher';
import { NO_FILTERS, waitItems } from '../state/filters';
import { recipeSpecs } from '../fixtures/recipeBox';

afterEach(cleanup);

function topBar(props: Partial<TopBarProps> = {}) {
  const switcher = {
    name: 'Recipe Box',
    progress: { done: 3, total: 9 },
    projects: [
      { id: 'p1', name: 'Recipe Box', root: '~/code/recipe-box', progress: { done: 3, total: 9 }, available: true },
      { id: 'p2', name: 'Empty', root: '~/code/empty', progress: { done: 0, total: 0 }, available: false },
    ],
    current: 'p1',
    open: false,
    onToggle: vi.fn(),
    onPick: vi.fn(),
    onOpenFolder: vi.fn(),
  };
  const p = { switcher, conn: 'live' as const, theme: 'light' as const, onToggleTheme: vi.fn(), onOpenRefs: vi.fn(), onOpenOverview: vi.fn(), ...props };
  render(<TopBar {...p} />);
  return p;
}

describe('TopBar', () => {
  it('shows the project, its progress and the live state', () => {
    topBar();
    expect(screen.getByRole('button', { name: /Recipe Box/ }).textContent).toBe('Recipe Box3/9 done');
    expect(screen.getByTestId('conn').textContent).toBe('');
    expect(screen.queryByText('Live')).toBeNull();
    expect(screen.getByTestId('conn').title).toBe('Connected. Watching specs/ for changes.');
    expect(screen.queryByTestId('spinner')).toBeNull();
  });

  it('Reconnecting… has a spinner; Disconnected a red dot; live a green one', () => {
    topBar({ conn: 'reconnecting' });
    expect(screen.getByTestId('conn').title).toBe('Not connected to the local server');
    expect(screen.getByTestId('spinner')).toBeTruthy();
    cleanup();
    topBar({ conn: 'disconnected' });
    expect(screen.getByTestId('conn').title).toBe('Not connected to the local server');
    expect(screen.getByTestId('conn').firstElementChild!.getAttribute('style')).toContain('var(--block)');
    cleanup();
    topBar({ conn: 'live' });
    expect(screen.getByTestId('conn').firstElementChild!.getAttribute('style')).toContain('var(--done)');
  });

  it('dark mode is a switch in the logo menu, and clicking it keeps the menu open', () => {
    const p = topBar({ theme: 'dark', brandOpen: true });
    const sw = screen.getByRole('menuitemcheckbox', { name: 'Dark mode' });
    expect(sw.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(sw);
    expect(p.onToggleTheme).toHaveBeenCalled();
    expect(screen.getByRole('menu')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Switch to (light|dark) theme/ })).toBeNull();
  });

  it('the switcher lists projects with progress and a tick', () => {
    const base = topBar();
    cleanup();
    topBar({ switcher: { ...base.switcher, open: true } });
    const items = screen.getAllByRole('menuitemradio');
    expect(items.map((i) => i.getAttribute('aria-checked'))).toEqual(['true', 'false']);
    expect(items[1]!.textContent).toBe('Empty~/code/emptyNo specs yet');
    fireEvent.click(items[1]!);
    expect(base.switcher.onPick).toHaveBeenCalledWith('p2');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Open another project folder…' }));
    expect(base.switcher.onOpenFolder).toHaveBeenCalled();
  });

  it('each project in the list has a dot: green and "Folder found", or grey and "Folder missing"', () => {
    const base = topBar();
    cleanup();
    topBar({ switcher: { ...base.switcher, open: true } });
    const a = screen.getByTestId('avail-p1');
    const b = screen.getByTestId('avail-p2');
    expect(a.title).toBe('Folder found');
    expect(a.getAttribute('style')).toContain('var(--done)');
    expect(b.title).toBe('Folder missing');
    expect(b.getAttribute('style')).toContain('var(--fg3)');
  });

  it('progressText', () => {
    expect(progressText({ done: 0, total: 0 })).toBe('No specs yet');
    expect(progressText({ done: 2, total: 5 })).toBe('2/5 done');
  });
});

describe('ConnectionBanner', () => {
  it('is hidden while live', () => {
    const { container } = render(<ConnectionBanner conn="live" onReconnect={vi.fn()} />);
    expect(container.textContent).toBe('');
  });

  it('reconnecting copy, no button', () => {
    render(<ConnectionBanner conn="reconnecting" onReconnect={vi.fn()} />);
    expect(screen.getByRole('status').textContent).toBe('Reconnecting…Edits will save once the connection is back.');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('disconnected copy and Reconnect', () => {
    const onReconnect = vi.fn();
    render(<ConnectionBanner conn="disconnected" onReconnect={onReconnect} />);
    expect(screen.getByRole('status').textContent).toContain('The board can’t see file changes, and edits won’t save until it’s back.');
    fireEvent.click(screen.getByRole('button', { name: 'Reconnect' }));
    expect(onReconnect).toHaveBeenCalled();
  });
});

function filterBar(props: Partial<FilterBarProps> = {}) {
  const p: FilterBarProps = {
    filters: NO_FILTERS,
    onChange: vi.fn(),
    categories: [
      { name: 'Frontend', n: 6 },
      { name: 'Backend', n: 3 },
    ],
    waits: waitItems(recipeSpecs),
    onWait: vi.fn(),
    menu: null,
    onMenu: vi.fn(),
    ...props,
  };
  render(<FilterBar {...p} />);
  return p;
}

describe('FilterBar', () => {
  it('no filters → no chips; the waiting items on the right', () => {
    const p = filterBar();
    expect(screen.queryByText('Clear')).toBeNull();
    fireEvent.click(screen.getByText('2 blocked'));
    expect(p.onWait).toHaveBeenCalledWith(expect.objectContaining({ kind: 'blocked' }));
  });

  it('category menu toggles a category', () => {
    const p = filterBar({ menu: 'cat' });
    fireEvent.click(screen.getByRole('checkbox', { name: /Backend/ }));
    expect(p.onChange).toHaveBeenCalledWith({ cats: ['Backend'], urg: [], blocked: false, milestone: null });
  });

  it('urgency menu lists Urgent to Low', () => {
    const p = filterBar({ menu: 'urg' });
    expect(screen.getAllByRole('checkbox').map((c) => c.parentElement!.textContent)).toEqual(['Urgent', 'High', 'Normal', 'Low']);
    fireEvent.click(screen.getByRole('checkbox', { name: /Urgent/ }));
    expect(p.onChange).toHaveBeenCalledWith({ cats: [], urg: ['urgent'], blocked: false, milestone: null });
  });

  it('active filters show as chips with counts, removable, plus Clear', () => {
    const p = filterBar({ filters: { cats: ['Backend'], urg: ['normal'], blocked: true, milestone: null } });
    expect(screen.getByRole('button', { name: /^Category/ }).textContent).toBe('Category1');
    expect(screen.getAllByRole('button', { name: 'Remove filter' })).toHaveLength(3);
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove filter' })[0]!);
    expect(p.onChange).toHaveBeenCalledWith({ cats: [], urg: ['normal'], blocked: true, milestone: null });
    fireEvent.click(screen.getByText('Clear'));
    expect(p.onChange).toHaveBeenLastCalledWith(NO_FILTERS);
    expect(screen.getByRole('switch', { name: 'Blocked only' }).getAttribute('aria-checked')).toBe('true');
  });
});
