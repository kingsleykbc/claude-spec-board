import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Markdown } from './Markdown';

afterEach(cleanup);

describe('Markdown', () => {
  it('renders headings, inline code, lists, code blocks and GFM tables', () => {
    const md = '# Title\n\n## Features\n\n### Sub\n\nSome **bold** and `code`.\n\n- One\n- Two\n\n```\nnpm test\n```\n\n| a | b |\n|---|---|\n| 1 | 2 |\n';
    const { container } = render(<Markdown md={md} />);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Title');
    expect(screen.getByRole('heading', { level: 3 }).textContent).toBe('Features');
    expect(screen.getByRole('heading', { level: 4 }).textContent).toBe('Sub');
    expect(container.querySelector('strong')?.textContent).toBe('bold');
    expect(container.querySelectorAll('li')).toHaveLength(2);
    expect(container.querySelector('pre code')?.textContent).toBe('npm test\n');
    expect(container.querySelector('table td')?.textContent).toBe('1');
  });

  it('gives headings anchors like GitHub does', () => {
    render(<Markdown md={'## Turn on background runs\n\n### What\'s `new`?\n'} />);
    expect(screen.getByRole('heading', { name: 'Turn on background runs' }).id).toBe('turn-on-background-runs');
    expect(screen.getByRole('heading', { level: 4 }).id).toBe('whats-new');
  });

  it('shows a placeholder for empty input and records the size', () => {
    const { container } = render(<Markdown md="  " size="sm" />);
    expect(screen.getByText('Nothing here yet.')).toBeTruthy();
    expect((container.firstChild as HTMLElement).dataset.size).toBe('sm');
  });

  it('opens links in a new tab, safely', () => {
    render(<Markdown md="[docs](https://example.com/a)" />);
    const a = screen.getByRole('link', { name: 'docs' });
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('never renders raw HTML as elements', () => {
    const md = '<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n<b>bold</b>';
    const { container } = render(<Markdown md={md} />);
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
  });

  it('drops javascript: link targets', () => {
    const { container } = render(<Markdown md="[x](javascript:alert(1))" />);
    for (const a of container.querySelectorAll('a')) expect(a.getAttribute('href') ?? '').not.toMatch(/^javascript:/i);
  });

  it('renders images as links instead of loading them', () => {
    const { container } = render(<Markdown md="![logo](https://example.com/x.png)" />);
    expect(container.querySelector('img')).toBeNull();
    const a = screen.getByRole('link');
    expect(a.getAttribute('href')).toBe('https://example.com/x.png');
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('rel')).toBe('noopener noreferrer');
    expect(a.textContent).toBe('🖼 logo');
  });
});
