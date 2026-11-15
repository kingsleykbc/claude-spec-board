import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { composeStories } from '@storybook/react-vite';
import * as stories from './toggle-group.stories';

const { Default } = composeStories(stories);

afterEach(cleanup);

describe('ToggleGroup', () => {
  it('selecting an item sets data-state="on" and turns the other off', async () => {
    const user = userEvent.setup();
    render(<Default />);
    const board = screen.getByRole('radio', { name: 'Board' });
    const table = screen.getByRole('radio', { name: 'Table' });
    expect(board.getAttribute('data-state')).toBe('on');
    expect(table.getAttribute('data-state')).toBe('off');

    await user.click(table);
    expect(table.getAttribute('data-state')).toBe('on');
    expect(board.getAttribute('data-state')).toBe('off');
  });
});
