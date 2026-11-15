import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { composeStories } from '@storybook/react-vite';
import * as stories from './dropdown-menu.stories';

const { Default } = composeStories(stories);

afterEach(cleanup);

describe('DropdownMenu', () => {
  it('opens on Enter, shows its items, and the submenu item opens its submenu', async () => {
    const user = userEvent.setup();
    render(<Default />);
    const trigger = screen.getByRole('button', { name: 'Menu' });
    trigger.focus();
    await user.keyboard('{Enter}');

    expect(await screen.findByRole('menu')).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Settings' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Sync with Claude' })).toBeTruthy();

    await user.click(screen.getByRole('menuitem', { name: 'Theme' }));
    const dark = await screen.findByRole('menuitemradio', { name: 'Dark' });
    expect(dark.getAttribute('aria-checked')).toBe('false');
    expect(screen.getByRole('menuitemradio', { name: 'System' }).getAttribute('aria-checked')).toBe('true');
  });
});
