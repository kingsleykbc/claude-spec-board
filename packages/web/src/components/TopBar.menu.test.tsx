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
    expect(item.getAttribute('href')).toBe('/docs');
    expect(item.getAttribute('target')).toBe('_blank');
    item.addEventListener('click', (e) => e.preventDefault());
    fireEvent.click(item);
    expect(onToggleBrand).toHaveBeenCalled();
  });
});
