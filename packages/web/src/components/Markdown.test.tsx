import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Markdown } from './Markdown';

afterEach(cleanup);

describe('Markdown', () => {
  it('renders headings, inline code, lists, code blocks and GFM tables', () => {
    const md = '# Title\n\n## Features\n\n### Sub\n\nSome **bold** and `code`.\n\n- One\n- Two\n\n```\nnpm test\n```\n\n| a | b |\n|---|---|\n| 1 | 2 |\n';
    const { container } = render(<Markdown md={md} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Title');
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Features');
    expect(screen.getByRole('heading', { level: 3 }).textContent).toBe('Sub');
    expect(container.querySelector('strong')?.textContent).toBe('bold');
    expect(container.querySelectorAll('li')).toHaveLength(2);
    expect(container.querySelector('pre code')?.textContent).toBe('npm test\n');
    expect(container.querySelector('table td')?.textContent).toBe('1');
  });

  it('shows a placeholder for empty input and records the size', () => {
    const { container } = render(<Markdown md="  " size="sm" />);
    expect(screen.getByText('Nothing here yet.')).toBeTruthy();
    expect((container.firstChild as HTMLElement).dataset.size).toBe('sm');
  });
});
