import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { composeStories } from '@storybook/react-vite';
import * as stories from './info-popover.stories';

const { Default, Untitled } = composeStories(stories);

afterEach(cleanup);

describe('InfoPopover', () => {
  it('opens on click with its title, and Escape closes it', async () => {
    const user = userEvent.setup();
    render(<Default />);
    const trigger = screen.getByRole('button', { name: 'Why is this card obsolete?' });
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(trigger);
    const pop = await screen.findByRole('dialog', { name: 'Obsolete' });
    expect(pop.textContent).toContain('Obsolete');
    expect(pop.textContent).toContain('Replaced by T-104');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('without a title, the popover is named by the label', async () => {
    const user = userEvent.setup();
    render(<Untitled />);
    await user.click(screen.getByRole('button', { name: 'Why is this card obsolete?' }));
    expect((await screen.findByRole('dialog', { name: 'Why is this card obsolete?' })).textContent).toBe('Replaced by T-104, which covers the same ground.');
  });
});
