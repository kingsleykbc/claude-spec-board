import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FilterBar, type FilterBarProps } from './FilterBar';
import { NO_FILTERS, waitItems } from '../state/filters';
import { recipeSpecs } from '../fixtures/recipeBox';

afterEach(cleanup);

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
