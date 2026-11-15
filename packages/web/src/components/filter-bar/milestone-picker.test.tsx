import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { composeStories } from '@storybook/react-vite';
import * as stories from './milestone-picker.stories';

const { Default, AllMilestones, Narrow } = composeStories(stories);

afterEach(cleanup);

describe('MilestonePicker', () => {
  it('shows "Basics · 2/3" as plain text: the name in bold, then the count, then a chevron; no input or select', () => {
    const { container } = render(<Default />);
    const trigger = screen.getByRole('button', { name: 'Milestone: Basics' });
    expect(trigger.tagName).toBe('BUTTON');
    expect(trigger.textContent).toBe('Basics · 2/3');
    const name = trigger.firstElementChild as HTMLElement;
    expect(name.textContent).toBe('Basics');
    expect(name.className).toMatch(/\bfont-(semibold|bold)\b/);
    const count = name.nextElementSibling as HTMLElement;
    expect(count.textContent).toBe(' · 2/3');
    expect(count.className).toMatch(/\btext-fg2\b/);
    expect(trigger.querySelector('svg')).toBeTruthy();
    expect(trigger.className).not.toMatch(/\bborder-line\b/);
    expect(container.querySelector('input, select')).toBeNull();
  });

  it('All milestones shows the total over every milestone', () => {
    render(<AllMilestones />);
    expect(screen.getByRole('button', { name: 'Milestone: All milestones' }).textContent).toBe('All milestones · 3/8');
  });

  it('wide: a menu named Milestone lists each milestone with done/total, then All milestones; picking one closes it', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Default onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'Milestone: Basics' }));
    const menu = await screen.findByRole('menu', { name: 'Milestone' });
    const items = within(menu).getAllByRole('menuitemradio');
    expect(items.map((x) => x.textContent)).toEqual(['Basics2/3', 'Planner0/2', 'No milestone1/3', 'All milestones']);
    expect(items.map((x) => x.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false', 'false']);
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(within(menu).getByRole('menuitemradio', { name: /^Planner/ }));
    expect(onChange).toHaveBeenCalledWith('Planner');
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(screen.getByRole('button', { name: 'Milestone: Planner' }).textContent).toBe('Planner · 0/2');
  });

  it('picking All milestones passes null', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Default onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'Milestone: Basics' }));
    await user.click(await screen.findByRole('menuitemradio', { name: 'All milestones' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('narrow (720px): opens as a drawer named Milestone with the same choices', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Narrow onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'Milestone: Basics' }));
    const sheet = await screen.findByRole('dialog', { name: 'Milestone' });
    expect(within(sheet).getAllByRole('menuitemradio').map((x) => x.textContent)).toEqual(['Basics2/3', 'Planner0/2', 'No milestone1/3', 'All milestones']);
    await user.click(within(sheet).getByRole('menuitemradio', { name: 'All milestones' }));
    expect(onChange).toHaveBeenCalledWith(null);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
