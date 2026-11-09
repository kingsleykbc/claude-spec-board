import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SunIcon } from '../lib/icons';
import { TOAST } from '../state/toasts';
import { TopBar, type TopBarProps } from './TopBar';
import { ConnectionBanner } from './ConnectionBanner';
import { FilterBar, type FilterBarProps } from './FilterBar';
import { Toasts } from './Toasts';
import { progressText } from './ProjectSwitcher';
import { NO_FILTERS, waitItems } from '../state/filters';
import { recipeSpecs } from '../fixtures/recipeBox';

afterEach(cleanup);

function topBar(props: Partial<TopBarProps> = {}) {
  const switcher = {
    name: 'Recipe Box',
    progress: { done: 3, total: 9 },
    projects: [
      { id: 'p1', name: 'Recipe Box', root: '~/code/recipe-box', progress: { done: 3, total: 9 } },
      { id: 'p2', name: 'Empty', root: '~/code/empty', progress: { done: 0, total: 0 } },
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
    expect(screen.getByTestId('conn').textContent).toBe('Live');
    expect(screen.getByTestId('conn').title).toBe('Connected. Watching specs/ for changes.');
    expect(screen.queryByTestId('spinner')).toBeNull();
  });

  it('Reconnecting… has a spinner; Disconnected a red dot', () => {
    topBar({ conn: 'reconnecting' });
    expect(screen.getByTestId('conn').textContent).toBe('Reconnecting…');
    expect(screen.getByTestId('spinner')).toBeTruthy();
    cleanup();
    topBar({ conn: 'disconnected' });
    expect(screen.getByTestId('conn').textContent).toBe('Disconnected');
    expect(screen.getByTestId('conn').style.color).toBe('var(--block-ink)');
  });

  it('theme toggle icon and label', () => {
    const p = topBar({ theme: 'dark' });
    const b = screen.getByRole('button', { name: 'Switch to light theme' });
    expect(b.innerHTML).toBe(renderToStaticMarkup(<SunIcon aria-hidden />));
    fireEvent.click(b);
    expect(p.onToggleTheme).toHaveBeenCalled();
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
    expect(p.onChange).toHaveBeenCalledWith({ cats: ['Backend'], urg: [], blocked: false });
  });

  it('urgency menu lists Urgent to Low', () => {
    const p = filterBar({ menu: 'urg' });
    expect(screen.getAllByRole('checkbox').map((c) => c.parentElement!.textContent)).toEqual(['Urgent', 'High', 'Normal', 'Low']);
    fireEvent.click(screen.getByRole('checkbox', { name: /Urgent/ }));
    expect(p.onChange).toHaveBeenCalledWith({ cats: [], urg: ['urgent'], blocked: false });
  });

  it('active filters show as chips with counts, removable, plus Clear', () => {
    const p = filterBar({ filters: { cats: ['Backend'], urg: ['normal'], blocked: true } });
    expect(screen.getByRole('button', { name: /^Category/ }).textContent).toBe('Category1');
    expect(screen.getAllByRole('button', { name: 'Remove filter' })).toHaveLength(3);
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove filter' })[0]!);
    expect(p.onChange).toHaveBeenCalledWith({ cats: [], urg: ['normal'], blocked: true });
    fireEvent.click(screen.getByText('Clear'));
    expect(p.onChange).toHaveBeenLastCalledWith(NO_FILTERS);
    expect(screen.getByRole('switch', { name: 'Blocked only' }).getAttribute('aria-checked')).toBe('true');
  });
});

describe('Toasts', () => {
  it('renders each kind with its icon and dismisses', () => {
    const onDismiss = vi.fn();
    render(
      <Toasts
        onDismiss={onDismiss}
        toasts={[
          { id: 1, kind: 'ok', text: 'T-104 moved to Review', sub: 'Meal planner calendar' },
          { id: 2, kind: 'err', text: 'Couldn’t move T-105' },
        ]}
      />,
    );
    const icons = [...document.querySelectorAll('[data-kind]')].map((t) => t.firstElementChild!.innerHTML);
    expect(icons).toEqual([renderToStaticMarkup(<TOAST.ok.icon aria-hidden />), renderToStaticMarkup(<TOAST.err.icon aria-hidden />)]);
    expect(screen.getByText('Meal planner calendar')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Dismiss' })[1]!);
    expect(onDismiss).toHaveBeenCalledWith(2);
  });
});
