import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { composeStories } from '@storybook/react-vite';
import * as stories from './filters-drawer.stories';
import { activeFilterCount } from './filters-drawer';
import { NO_FILTERS } from '@/state/filters';

const { NoFilters, Active, Open } = composeStories(stories);

afterEach(cleanup);

const badge = () => screen.queryByTestId('filter-count');

describe('FiltersDrawer', () => {
  it('counts each category, each urgency and Blocked only', () => {
    expect(activeFilterCount(NO_FILTERS)).toBe(0);
    expect(activeFilterCount({ ...NO_FILTERS, cats: ['Backend'] })).toBe(1);
    expect(activeFilterCount({ cats: ['Backend', 'Frontend'], urg: ['urgent'], blocked: true, milestone: 'Basics' })).toBe(4);
  });

  it('no filters: a "Filters" button with no badge', () => {
    render(<NoFilters />);
    expect(screen.getByRole('button', { name: 'Filters' })).toBeTruthy();
    expect(badge()).toBeNull();
  });

  it('the badge shows how many filters are on', () => {
    render(<Active />);
    expect(badge()!.textContent).toBe('4');
    expect(screen.getByRole('button', { name: 'Filters, 4 active' })).toBeTruthy();
  });

  it('opens a bottom drawer with Category, Urgency and Blocked only', async () => {
    const user = userEvent.setup();
    render(<Open />);
    expect(badge()!.textContent).toBe('1');
    await user.click(screen.getByRole('button', { name: /^Filters/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Filters' });
    const cat = within(sheet).getByRole('group', { name: 'Category' });
    expect((within(cat).getByRole('checkbox', { name: /Backend/ }) as HTMLInputElement).checked).toBe(true);
    expect((within(cat).getByRole('checkbox', { name: /Frontend/ }) as HTMLInputElement).checked).toBe(false);
    const urg = within(sheet).getByRole('group', { name: 'Urgency' });
    expect(within(urg).getAllByRole('checkbox').map((c) => c.closest('label')!.textContent)).toEqual(['Urgent', 'High', 'Normal', 'Low']);
    expect(within(sheet).getByRole('switch', { name: 'Blocked only' }).getAttribute('aria-checked')).toBe('false');
    expect(within(sheet).getByRole('button', { name: 'Clear filters' })).toBeTruthy();
  });

  it('each control changes the filters; Clear filters keeps the milestone', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Open onChange={onChange} initial={{ ...NO_FILTERS, cats: ['Backend'], milestone: 'Basics' }} />);
    await user.click(screen.getByRole('button', { name: /^Filters/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Filters' });
    await user.click(within(sheet).getByRole('checkbox', { name: /Urgent/ }));
    expect(onChange).toHaveBeenLastCalledWith({ cats: ['Backend'], urg: ['urgent'], blocked: false, milestone: 'Basics' });
    await user.click(within(sheet).getByRole('checkbox', { name: /Backend/ }));
    expect(onChange).toHaveBeenLastCalledWith({ cats: [], urg: ['urgent'], blocked: false, milestone: 'Basics' });
    await user.click(within(sheet).getByRole('switch', { name: 'Blocked only' }));
    expect(onChange).toHaveBeenLastCalledWith({ cats: [], urg: ['urgent'], blocked: true, milestone: 'Basics' });
    expect(badge()!.textContent).toBe('2');
    const clear = within(sheet).getByRole('button', { name: 'Clear filters' });
    expect(clear.getAttribute('aria-disabled')).toBe('false');
    await user.click(clear);
    expect(onChange).toHaveBeenLastCalledWith({ ...NO_FILTERS, milestone: 'Basics' });
    expect(badge()).toBeNull();
    // Nothing left to clear: it says so but keeps focus, and a second press does nothing.
    expect(clear.getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(clear);
    const calls = onChange.mock.calls.length;
    await user.click(clear);
    expect(onChange).toHaveBeenCalledTimes(calls);
  });
});
