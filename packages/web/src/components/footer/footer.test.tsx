import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { composeStories } from '@storybook/react-vite';
import * as stories from './footer.stories';
import { REPO_URL } from './footer';

const { Default } = composeStories(stories);

afterEach(cleanup);

describe('Footer', () => {
  it('reads "Spec Board · made by Kingsleykbc", with the name linking to the author', () => {
    render(<Default />);
    const footer = screen.getByRole('contentinfo');
    expect(footer.textContent).toMatch(/^Spec Boards*·s*made by Kingsleykbc/);
    const author = screen.getByRole('link', { name: 'Kingsleykbc' });
    expect(author.getAttribute('href')).toBe('https://github.com/kingsleykbc');
    expect(author.getAttribute('target')).toBe('_blank');
  });

  it('keeps a plain GitHub link to the repo, and no star button', () => {
    render(<Default />);
    const a = screen.getByRole('link', { name: /^GitHub$/ });
    expect(a.getAttribute('href')).toBe(REPO_URL);
    expect(a.getAttribute('target')).toBe('_blank');
    expect(screen.queryByRole('link', { name: /Star on GitHub/ })).toBeNull();
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
