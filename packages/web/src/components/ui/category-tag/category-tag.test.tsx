import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { composeStories } from '@storybook/react-vite';
import * as stories from './category-tag.stories';
import { catColor } from '@/lib/vm';

const { Default, Several } = composeStories(stories);

afterEach(cleanup);

describe('CategoryTag', () => {
  it('shows the name with a dot before it', () => {
    render(<Default />);
    const tag = screen.getByText('Search');
    const dot = tag.firstElementChild as HTMLElement;
    expect(dot.tagName).toBe('SPAN');
    expect(dot.textContent).toBe('');
    expect(tag.textContent).toBe('Search');
  });

  it('colours the dot from the name', () => {
    // happy-dom drops oklch() from inline styles, so the story's play checks the colours in a real browser.
    expect(catColor('Search')).toMatch(/^oklch\(/);
    expect(catColor('Search')).not.toBe(catColor('Shopping'));
    render(<Several />);
    expect(screen.getAllByText(/Search|Meal plans|Shopping|Infra/)).toHaveLength(4);
  });
});
