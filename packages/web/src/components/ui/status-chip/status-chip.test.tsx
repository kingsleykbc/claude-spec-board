import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { composeStories } from '@storybook/react-vite';
import * as stories from './status-chip.stories';

const { Default, Blocked, StatusChips } = composeStories(stories);

afterEach(cleanup);

describe('StatusChip', () => {
  it('shows the status label and records the status', () => {
    const { container } = render(<Default />);
    const chip = container.querySelector('[data-status]') as HTMLElement;
    expect(chip.dataset.status).toBe('doing');
    expect(chip.textContent).toContain('Doing');
    expect(chip.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('has a Blocked pill', () => {
    const { container } = render(<Blocked />);
    expect((container.querySelector('[data-status]') as HTMLElement).dataset.status).toBe('blocked');
    expect(screen.getByText(/Blocked/)).toBeTruthy();
  });

  it('shows every status in both themes', () => {
    render(<StatusChips />);
    for (const l of ['To-do', 'Doing', 'Review', 'Done', 'Blocked']) expect(screen.getAllByText(new RegExp(l))).toHaveLength(2);
  });
});
