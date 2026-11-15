import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { composeStories } from '@storybook/react-vite';
import * as stories from './responsive-menu.stories';

const { Wide, Narrow } = composeStories(stories);

afterEach(cleanup);

describe('ResponsiveMenu', () => {
  it('wide: opens a dropdown; an item calls onSelect and the menu closes', async () => {
    const user = userEvent.setup();
    const onSettings = vi.fn();
    render(<Wide onSettings={onSettings} />);
    await user.click(screen.getByRole('button', { name: 'Menu' }));

    const menu = await screen.findByRole('menu');
    expect(within(menu).getByText('Board')).toBeTruthy();
    expect(within(menu).getByRole('menuitem', { name: 'Export (soon)' }).getAttribute('aria-disabled')).toBe('true');
    await user.click(within(menu).getByRole('menuitem', { name: 'Settings' }));
    expect(onSettings).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  });

  it('wide: a sub opens as a flyout with checked items', async () => {
    const user = userEvent.setup();
    render(<Wide />);
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Theme' }));
    const system = await screen.findByRole('menuitemcheckbox', { name: 'System' });
    expect(system.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('menuitemcheckbox', { name: 'Dark' }).getAttribute('aria-checked')).toBe('false');
  });

  it('narrow: opens a drawer titled with the menu title, and a sub shows as a group', async () => {
    const user = userEvent.setup();
    const onSync = vi.fn();
    render(<Narrow onSync={onSync} />);
    await user.click(screen.getByRole('button', { name: 'Menu' }));

    const sheet = await screen.findByRole('dialog', { name: 'Board menu' });
    const group = within(sheet).getByRole('group', { name: 'Theme' });
    expect(within(group).getByRole('menuitemcheckbox', { name: 'System' }).getAttribute('aria-checked')).toBe('true');
    expect(within(sheet).getByRole('menuitem', { name: 'Export (soon)' }).hasAttribute('disabled')).toBe(true);
    expect(within(sheet).getByRole('separator')).toBeTruthy();

    await user.click(within(sheet).getByRole('menuitem', { name: 'Sync with Claude' }));
    expect(onSync).toHaveBeenCalledTimes(1);
    // vaul keeps the sheet mounted for its slide-out (happy-dom never ends it), so check the state.
    await waitFor(() => expect(sheet.getAttribute('data-state')).toBe('closed'));
    expect(screen.getByRole('button', { name: 'Menu', hidden: true }).getAttribute('aria-expanded')).toBe('false');
  });

  it('narrow: restores matchMedia after the story unmounts', () => {
    const before = window.matchMedia;
    const { unmount } = render(<Narrow />);
    expect(window.matchMedia('(max-width: 720px)').matches).toBe(true);
    unmount();
    expect(window.matchMedia).toBe(before);
  });
});
