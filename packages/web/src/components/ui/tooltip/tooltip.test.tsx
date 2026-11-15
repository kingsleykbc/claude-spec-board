import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { composeStories } from '@storybook/react-vite';
import * as stories from './tooltip.stories';

const { Default } = composeStories(stories);

afterEach(cleanup);

describe('Tooltip', () => {
  it('shows its label on focus', async () => {
    const user = userEvent.setup();
    render(<Default />);
    expect(screen.queryByRole('tooltip')).toBeNull();

    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Logs' }));
    expect((await screen.findByRole('tooltip')).textContent).toBe('Logs');
  });
});
