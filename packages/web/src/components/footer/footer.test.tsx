import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { composeStories } from '@storybook/react-vite';
import * as stories from './footer.stories';
import { REPO_URL } from './footer';

const { Default } = composeStories(stories);

afterEach(cleanup);

describe('Footer', () => {
  it('credits the author and links to the repo, opening in a new tab', () => {
    render(<Default />);
    expect(screen.getByText(/Spec Board, made by/)).toBeTruthy();
    for (const name of [/^GitHub$/, /Star on GitHub/]) {
      const a = screen.getByRole('link', { name });
      expect(a.getAttribute('href')).toBe(REPO_URL);
      expect(a.getAttribute('target')).toBe('_blank');
    }
  });

  it('is slim: pt-3 pb-4, with the phone pb-[84px] kept', () => {
    render(<Default />);
    const c = screen.getByRole('contentinfo').className;
    expect(c.split(' ')).toContain('pt-3');
    expect(c.split(' ')).toContain('pb-4');
    expect(c).toContain('pb-[84px]');
  });

  it('centres its content', () => {
    render(<Default />);
    expect(screen.getByRole('contentinfo').className).toMatch(/\bjustify-center\b/);
  });
});
