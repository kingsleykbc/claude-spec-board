import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { composeStories } from '@storybook/react-vite';
import * as stories from './popover.stories';

const { Default } = composeStories(stories);

afterEach(cleanup);

describe('Popover', () => {
  it('opens on click and closes on Escape', async () => {
    const user = userEvent.setup();
    render(<Default />);
    const trigger = screen.getByRole('button', { name: 'Why obsolete?' });
    await user.click(trigger);

    expect((await screen.findByRole('dialog')).textContent).toContain('Replaced by T-104');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });
});
