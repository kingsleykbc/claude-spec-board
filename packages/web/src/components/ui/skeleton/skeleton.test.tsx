import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { composeStories } from '@storybook/react-vite';
import * as stories from './skeleton.stories';

const { App, Board, Document } = composeStories(stories);

afterEach(cleanup);

describe('Skeleton loaders', () => {
  it('the board skeleton has four columns of placeholder cards and says it is loading', () => {
    render(<Board />);
    const s = screen.getByRole('status');
    expect(s.textContent).toBe('Loading the board…');
    const cols = screen.getAllByTestId('skeleton-column');
    expect(cols).toHaveLength(4);
    expect(cols.map((c) => c.querySelectorAll('[data-slot="skeleton"]').length > 2)).toEqual([true, true, true, true]);
    // Grey blocks only: hidden from screen readers.
    expect([...s.querySelectorAll('[data-slot="skeleton"]')].every((x) => x.getAttribute('aria-hidden') === 'true')).toBe(true);
  });

  it('the app skeleton adds the top bar outline', () => {
    const { container } = render(<App />);
    expect(container.querySelectorAll('[aria-hidden="true"] [data-slot="skeleton"]').length).toBeGreaterThan(3);
    expect(screen.getByRole('status').textContent).toBe('Loading the board…');
  });

  it('the document skeleton takes its own label', () => {
    render(<Document />);
    expect(screen.getByRole('status').textContent).toBe('Loading reference documents…');
  });
});
