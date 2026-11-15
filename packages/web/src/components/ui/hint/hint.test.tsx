import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { composeStories } from '@storybook/react-vite';
import * as stories from './hint.stories';

const { Default, OwnLabel, AroundMenuTrigger } = composeStories(stories);

afterEach(cleanup);

describe('Hint', () => {
  it('names an icon-only button and shows the label on focus', async () => {
    const user = userEvent.setup();
    render(<Default />);
    const button = screen.getByRole('button', { name: 'Settings' });
    expect(button.getAttribute('aria-label')).toBe('Settings');
    expect(screen.queryByRole('tooltip')).toBeNull();

    await user.tab();
    expect(document.activeElement).toBe(button);
    expect((await screen.findByRole('tooltip')).textContent).toBe('Settings');
  });

  it('keeps an aria-label the trigger already has', async () => {
    const user = userEvent.setup();
    render(<OwnLabel />);
    const button = screen.getByRole('button', { name: 'Settings' });
    expect(button.getAttribute('aria-label')).toBe('Settings');
    await user.tab();
    expect((await screen.findByRole('tooltip')).textContent).toBe('Open settings (,)');
  });

  it('wraps a menu trigger: the label shows on focus and a click still opens the menu', async () => {
    const user = userEvent.setup();
    render(<AroundMenuTrigger />);
    const button = screen.getByRole('button', { name: 'Card actions' });
    await user.tab();
    expect(document.activeElement).toBe(button);
    expect((await screen.findByRole('tooltip')).textContent).toBe('Card actions');
    await user.click(button);
    expect(await screen.findByRole('menuitem', { name: 'Archive' })).toBeTruthy();
    expect(button.getAttribute('aria-expanded')).toBe('true');
  });
});
