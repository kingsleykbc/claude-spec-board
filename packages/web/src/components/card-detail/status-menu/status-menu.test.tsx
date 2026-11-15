import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { composeStories } from '@storybook/react-vite';
import * as stories from './status-menu.stories';

const { Default, Narrow } = composeStories(stories);

afterEach(cleanup);

describe('StatusMenu', () => {
  it('opens a Status menu that notes Current and Approve; Esc closes it and a pick reports the status', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<Default status="todo" onPick={onPick} />);
    const btn = screen.getByRole('button', { name: 'To-do' });
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    await user.click(btn);
    const menu = await screen.findByRole('menu', { name: 'Status' });
    const items = within(menu).getAllByRole('menuitemradio');
    expect(items.map((i) => i.textContent)).toEqual(['To-doCurrent', 'Doing', 'Review', 'DoneApprove']);
    expect(items[0]!.getAttribute('aria-checked')).toBe('true');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(document.activeElement).toBe(btn);
    await user.click(btn);
    await user.click(await screen.findByRole('menuitemradio', { name: /Doing/ }));
    expect(onPick).toHaveBeenCalledWith('doing');
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  });

  it('a click outside closes it without picking anything', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<Default status="todo" onPick={onPick} />);
    await user.click(screen.getByRole('button', { name: 'To-do' }));
    await screen.findByRole('menu', { name: 'Status' });
    await user.click(document.body);
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(onPick).not.toHaveBeenCalled();
  });

  it('keyboard: Enter opens it, arrows move, Enter picks', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<Default status="todo" onPick={onPick} />);
    screen.getByRole('button', { name: 'To-do' }).focus();
    await user.keyboard('{Enter}');
    await screen.findByRole('menu', { name: 'Status' });
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onPick).toHaveBeenCalledWith('doing');
  });

  it('picking the current status sends nothing', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<Default status="todo" onPick={onPick} />);
    await user.click(screen.getByRole('button', { name: 'To-do' }));
    await user.click(await screen.findByRole('menuitemradio', { name: /To-do/ }));
    expect(onPick).not.toHaveBeenCalled();
  });

  it('narrow (720px): opens as a drawer titled Status', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<Narrow onPick={onPick} />);
    await user.click(screen.getByRole('button', { name: 'Review' }));
    const sheet = await screen.findByRole('dialog', { name: 'Status' });
    await user.click(within(sheet).getByRole('menuitemradio', { name: /Done/ }));
    expect(onPick).toHaveBeenCalledWith('done');
  });
});
