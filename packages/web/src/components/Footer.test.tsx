import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Footer, REPO_URL } from './Footer';

describe('Footer', () => {
  it('credits the author and links to the repo, opening in a new tab', () => {
    render(<Footer />);
    expect(screen.getByText(/Spec Board, made by/)).toBeTruthy();
    for (const name of [/^GitHub$/, /Star on GitHub/]) {
      const a = screen.getByRole('link', { name });
      expect(a.getAttribute('href')).toBe(REPO_URL);
      expect(a.getAttribute('target')).toBe('_blank');
    }
  });
});
