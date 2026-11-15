import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { composeStories } from '@storybook/react-vite';
import * as stories from './refresh-warning.stories';

const { Default } = composeStories(stories);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const COPY = 'These may be out of date after the last spec edit. Run /specboard:refresh-questions T-104 in Claude.';

describe('RefreshWarning', () => {
  it('hover shows the exact copy with the command for this spec', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('hover: hover'), media: q, addEventListener() {}, removeEventListener() {} }));
    render(<Default />);
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Questions may be out of date' }));
    const pop = screen.getByRole('dialog', { name: 'Questions may be out of date' });
    expect(pop.textContent).toContain(COPY);
    expect(pop.querySelector('code')?.textContent).toBe('/specboard:refresh-questions T-104');
  });

  it('the Subtasks heading labels its trigger "Subtasks may be out of date"', () => {
    render(<Default label="Subtasks may be out of date" />);
    expect(screen.getByRole('button', { name: 'Subtasks may be out of date' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Questions may be out of date' })).toBeNull();
  });

  it('a tap opens it, and Copy command puts the command on the clipboard', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<Default />);
    await user.click(screen.getByRole('button', { name: 'Questions may be out of date' }));
    await user.click(await screen.findByRole('button', { name: 'Copy command' }));
    expect(writeText).toHaveBeenCalledWith('/specboard:refresh-questions T-104');
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeTruthy();
  });
});
