import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { composeStories } from '@storybook/react-vite';
import * as stories from './drawer.stories';

const { Default } = composeStories(stories);

afterEach(cleanup);

describe('Drawer', () => {
  it('opens and shows its content', async () => {
    const user = userEvent.setup();
    render(<Default />);
    await user.click(screen.getByRole('button', { name: 'Open drawer' }));

    const sheet = await screen.findByRole('dialog', { name: 'Filters' });
    expect(sheet.textContent).toContain('Narrow the board by category and urgency.');
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy();
  });
});
