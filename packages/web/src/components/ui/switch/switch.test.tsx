import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { composeStories } from '@storybook/react-vite';
import * as stories from './switch.stories';

const { Default, On } = composeStories(stories);

afterEach(cleanup);

describe('Switch', () => {
  it('toggles aria-checked', async () => {
    const user = userEvent.setup();
    render(<Default />);
    const sw = screen.getByRole('switch', { name: 'Blocked only' });
    expect(sw.getAttribute('aria-checked')).toBe('false');
    await user.click(sw);
    expect(sw.getAttribute('aria-checked')).toBe('true');
    await user.click(sw);
    expect(sw.getAttribute('aria-checked')).toBe('false');
  });

  it('can start on', () => {
    render(<On />);
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true');
  });
});
