import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { composeStories } from '@storybook/react-vite';
import * as stories from './urgency.stories';

const { Default, AllLevels } = composeStories(stories);

afterEach(cleanup);

describe('Urgency', () => {
  it('shows three bars and the label, filled to the level', () => {
    render(<Default />);
    const root = screen.getByTitle('Urgency');
    expect(root.dataset.urgency).toBe('urgent');
    expect(screen.getByText('Urgent')).toBeTruthy();
    const bars = [...root.firstElementChild!.children] as HTMLElement[];
    expect(bars.map((b) => b.style.height)).toEqual(['5px', '8px', '11px']);
    expect(bars.every((b) => b.style.background === 'var(--accent)')).toBe(true);
  });

  it('fills fewer bars for lower levels', () => {
    render(<Default level="low" />);
    const bars = [...screen.getByTitle('Urgency').firstElementChild!.children] as HTMLElement[];
    expect(bars.map((b) => b.style.background)).toEqual(['var(--fg3)', 'var(--line2)', 'var(--line2)']);
  });

  it('shows every level', () => {
    render(<AllLevels />);
    for (const label of ['Urgent', 'High', 'Normal', 'Low']) expect(screen.getAllByText(label)).toHaveLength(2);
  });
});
