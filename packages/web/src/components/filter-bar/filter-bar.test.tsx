import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { composeStories } from '@storybook/react-vite';
import * as stories from './filter-bar.stories';
import { NO_FILTERS, waitItems } from '@/state/filters';
import { recipeSpecs } from '@/fixtures/recipeBox';

const { NoFilters, ActiveChips, SimpleMode, ViewAndMilestone, Narrow, JustWide } = composeStories(stories);

afterEach(cleanup);

const waits = waitItems(recipeSpecs);

describe('FilterBar', () => {
  it('no filters → no chips; the waiting items on the right', async () => {
    const user = userEvent.setup();
    const onWait = vi.fn();
    render(<NoFilters onWait={onWait} />);
    expect(screen.queryByText('Clear')).toBeNull();
    await user.click(screen.getByText('2 blocked'));
    expect(onWait).toHaveBeenCalledWith(expect.objectContaining({ kind: 'blocked' }));
  });

  it('category menu toggles a category and stays open for more', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<NoFilters onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /^Category/ }));
    const menu = await screen.findByRole('menu', { name: 'Category' });
    await user.click(within(menu).getByRole('menuitemcheckbox', { name: /Backend/ }));
    expect(onChange).toHaveBeenLastCalledWith({ cats: ['Backend'], urg: [], blocked: false, milestone: null });
    expect(within(menu).getByRole('menuitemcheckbox', { name: /Backend/ }).getAttribute('aria-checked')).toBe('true');
    await user.click(within(menu).getByRole('menuitemcheckbox', { name: /Frontend/ }));
    expect(onChange).toHaveBeenLastCalledWith({ cats: ['Backend', 'Frontend'], urg: [], blocked: false, milestone: null });
    expect(screen.getByRole('button', { name: /^Category/ }).textContent).toBe('Category2');
  });

  it('urgency menu lists Urgent to Low', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<NoFilters onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /^Urgency/ }));
    const menu = await screen.findByRole('menu', { name: 'Urgency' });
    expect(within(menu).getAllByRole('menuitemcheckbox').map((c) => c.textContent)).toEqual(['Urgent', 'High', 'Normal', 'Low']);
    await user.click(within(menu).getByRole('menuitemcheckbox', { name: /Urgent/ }));
    expect(onChange).toHaveBeenLastCalledWith({ cats: [], urg: ['urgent'], blocked: false, milestone: null });
  });

  it('active filters show as chips with counts, removable, plus Clear', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ActiveChips onChange={onChange} initial={{ cats: ['Backend'], urg: ['normal'], blocked: true, milestone: null }} />);
    expect(screen.getByRole('button', { name: /^Category/ }).textContent).toBe('Category1');
    expect(screen.getByRole('switch', { name: 'Blocked only' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getAllByRole('button', { name: 'Remove filter' })).toHaveLength(3);
    await user.click(screen.getAllByRole('button', { name: 'Remove filter' })[0]!);
    expect(onChange).toHaveBeenLastCalledWith({ cats: [], urg: ['normal'], blocked: true, milestone: null });
    await user.click(screen.getByText('Clear'));
    expect(onChange).toHaveBeenLastCalledWith(NO_FILTERS);
  });

  it('Clear keeps the chosen milestone', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ActiveChips onChange={onChange} initial={{ cats: ['Backend'], urg: [], blocked: false, milestone: 'Basics' }} />);
    await user.click(screen.getByText('Clear'));
    expect(onChange).toHaveBeenLastCalledWith({ ...NO_FILTERS, milestone: 'Basics' });
  });

  it('Blocked only is a switch', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<NoFilters onChange={onChange} />);
    const sw = screen.getByRole('switch', { name: 'Blocked only' });
    expect(sw.getAttribute('aria-checked')).toBe('false');
    await user.click(sw);
    expect(onChange).toHaveBeenLastCalledWith({ ...NO_FILTERS, blocked: true });
    expect(screen.getByRole('switch', { name: 'Blocked only' }).getAttribute('aria-checked')).toBe('true');
  });
});

describe('FilterBar: Board | Table switch', () => {
  it('is an icon-only radio group named View; items are "Board view" and "Table view" and switch the view', async () => {
    const user = userEvent.setup();
    render(<ViewAndMilestone />);
    const group = screen.getByRole('radiogroup', { name: 'View' });
    expect(group.dataset.tour).toBe('view');
    const board = within(group).getByRole('radio', { name: 'Board view' });
    const table = within(group).getByRole('radio', { name: 'Table view' });
    for (const item of [board, table]) {
      expect(item.textContent).toBe('');
      expect(item.querySelector('svg')).toBeTruthy();
    }
    expect(board.getAttribute('aria-checked')).toBe('true');
    await user.click(table);
    expect(table.getAttribute('aria-checked')).toBe('true');
    expect(board.getAttribute('aria-checked')).toBe('false');
    // Clicking the chosen one again keeps it chosen.
    await user.click(table);
    expect(table.getAttribute('aria-checked')).toBe('true');
    await user.click(board);
    expect(board.getAttribute('aria-checked')).toBe('true');
  });

  it('each item has a tooltip with its label', async () => {
    const user = userEvent.setup();
    render(<ViewAndMilestone />);
    await user.hover(screen.getByRole('radio', { name: 'Board view' }));
    expect(await screen.findByRole('tooltip', { name: 'Board view' })).toBeTruthy();
  });
});

describe('FilterBar: milestone picker', () => {
  it('shows "Basics · 2/3" in bold text, not in an input or select, and is board-only', async () => {
    const user = userEvent.setup();
    const { container } = render(<ViewAndMilestone />);
    const trigger = screen.getByRole('button', { name: 'Milestone: Basics' });
    expect(trigger.textContent).toBe('Basics · 2/3');
    expect(trigger.firstElementChild!.className).toMatch(/\bfont-(semibold|bold)\b/);
    expect(container.querySelector('input, select')).toBeNull();
    await user.click(trigger);
    await user.click(await screen.findByRole('menuitemradio', { name: 'All milestones' }));
    expect(screen.getByRole('button', { name: 'Milestone: All milestones' })).toBeTruthy();
    await user.click(screen.getByRole('radio', { name: 'Table view' }));
    expect(screen.queryByRole('button', { name: /^Milestone:/ })).toBeNull();
  });

  it('is absent without milestones', () => {
    render(<NoFilters />);
    expect(screen.queryByRole('button', { name: /milestone/i })).toBeNull();
  });
});

describe('FilterBar: narrow (720px)', () => {
  it('replaces Category, Urgency and Blocked only with a "Filters" button with a badge', () => {
    render(<Narrow />);
    expect(screen.queryByRole('button', { name: /^Category/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Urgency/ })).toBeNull();
    expect(screen.queryByRole('switch', { name: 'Blocked only' })).toBeNull();
    const filters = screen.getByRole('button', { name: /^Filters/ });
    expect(within(filters).getByTestId('filter-count').textContent).toBe('1');
    // The view switch and the milestone picker stay.
    expect(screen.getByRole('radio', { name: 'Board view' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Milestone: Basics' })).toBeTruthy();
  });

  it('the Filters button opens a drawer with the Category, Urgency and Blocked only controls', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Narrow onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /^Filters/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Filters' });
    expect(within(sheet).getByRole('group', { name: 'Category' })).toBeTruthy();
    expect(within(sheet).getByRole('group', { name: 'Urgency' })).toBeTruthy();
    await user.click(within(sheet).getByRole('switch', { name: 'Blocked only' }));
    expect(onChange).toHaveBeenLastCalledWith({ cats: ['Backend'], urg: [], blocked: true, milestone: 'Basics' });
    expect(within(screen.getByRole('button', { name: /^Filters/, hidden: true })).getByTestId('filter-count').textContent).toBe('2');
    await user.click(within(sheet).getByRole('button', { name: 'Clear filters' }));
    expect(onChange).toHaveBeenLastCalledWith({ ...NO_FILTERS, milestone: 'Basics' });
  });

  it('the milestone picker opens as a drawer', async () => {
    const user = userEvent.setup();
    render(<Narrow />);
    await user.click(screen.getByRole('button', { name: 'Milestone: Basics' }));
    expect(await screen.findByRole('dialog', { name: 'Milestone' })).toBeTruthy();
  });
});

describe('FilterBar: 721px', () => {
  it('keeps the controls inline; Category opens as a menu, not a drawer', async () => {
    const user = userEvent.setup();
    render(<JustWide />);
    expect(screen.queryByRole('button', { name: /^Filters/ })).toBeNull();
    expect(screen.getByRole('switch', { name: 'Blocked only' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /^Category/ }));
    expect(await screen.findByRole('menu', { name: 'Category' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('FilterBar: Simple mode', () => {
  it('has no Simple mode switch of its own (it is in the top bar)', () => {
    render(<NoFilters />);
    expect(screen.getAllByRole('switch').map((x) => x.getAttribute('aria-label') ?? x.closest('label')?.textContent)).toEqual(['Blocked only']);
  });

  it('full mode lists the waiting items; Simple mode puts them behind ⋯', async () => {
    const user = userEvent.setup();
    render(<NoFilters />);
    expect(screen.getByText('1 to review')).toBeTruthy();
    cleanup();
    render(<SimpleMode />);
    expect(screen.queryByText('1 to review')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Waiting on you' }));
    expect(await screen.findByRole('menu', { name: 'Waiting on you' })).toBeTruthy();
  });

  it('the ⋯ menu lists them; picking one closes the menu and acts', async () => {
    const user = userEvent.setup();
    const onWait = vi.fn();
    render(<SimpleMode onWait={onWait} />);
    await user.click(screen.getByRole('button', { name: 'Waiting on you' }));
    const menu = await screen.findByRole('menu', { name: 'Waiting on you' });
    const items = within(menu).getAllByRole('menuitem');
    expect(items.map((x) => x.textContent)).toEqual(waits.map((w) => w.text));
    await user.click(items[0]!);
    expect(onWait).toHaveBeenCalledWith(waits[0]);
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  });

  it('nothing waiting: no ⋯ at all', () => {
    render(<SimpleMode waits={[]} />);
    expect(screen.queryByRole('button', { name: 'Waiting on you' })).toBeNull();
  });
});
