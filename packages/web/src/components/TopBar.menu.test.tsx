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
