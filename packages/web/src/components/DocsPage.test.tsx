import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { DOCS_PAGES, docsLink, isDocsPath, pageForPath } from '../lib/docsPages';
import { DocsPage } from './DocsPage';

afterEach(cleanup);

describe('docs routes', () => {
  it('knows its own URLs and nothing else', () => {
    expect(isDocsPath('/docs')).toBe(true);
    expect(isDocsPath('/docs/safety')).toBe(true);
    expect(isDocsPath('/')).toBe(false);
    expect(isDocsPath('/docsy')).toBe(false);
  });

  it('finds a page, and falls back to the README', () => {
    expect(pageForPath('/docs').slug).toBe('');
    expect(pageForPath('/docs/safety/').slug).toBe('safety');
    expect(pageForPath('/docs/nope').slug).toBe('');
  });

  it('maps links between the Markdown files and leaves others alone', () => {
    expect(docsLink('docs/guide/safety.md')).toBe('/docs/safety');
    expect(docsLink('running-specs.md#why')).toBe('/docs/running-specs#why');
    expect(docsLink('../../README.md')).toBe('/docs');
    expect(docsLink('https://example.com/safety.md')).toBeNull();
    expect(docsLink('#here')).toBeNull();
    expect(docsLink('other.md')).toBeNull();
  });
});

describe('the documentation files', () => {
  const links = (md: string) => [...md.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]!).filter((h) => !/^[a-z]+:/i.test(h));

  it.each(DOCS_PAGES.map((p) => [p.title, p.md] as const))('%s has content and every link leads to a page', (_title, md) => {
    expect(md.startsWith('# ')).toBe(true);
    for (const href of links(md)) expect(docsLink(href), href).not.toBeNull();
  });

  it('don’t claim the unpublished install works', () => {
    const readme = DOCS_PAGES[0]!.md;
    expect(readme).toMatch(/isn't published yet/);
    expect(DOCS_PAGES.flatMap((p) => p.md.split('\n')).filter((l) => /^\s*npx /.test(l))).toEqual([]);
  });
});

describe('DocsPage', () => {
  it('shows the README first, with every page in the nav', () => {
    render(<DocsPage pathname="/docs" />);
    expect(screen.getByRole('heading', { name: 'Spec Board', level: 2 })).toBeTruthy();
    const nav = within(screen.getByRole('navigation', { name: 'Documentation' }));
    expect(nav.getAllByRole('link').map((a) => a.textContent)).toEqual(DOCS_PAGES.map((p) => p.title));
    expect(nav.getByRole('link', { name: 'Overview' }).getAttribute('aria-current')).toBe('page');
  });

  it('keeps links between pages in this tab, and sends others to a new one', () => {
    render(<DocsPage pathname="/docs" />);
    const main = within(screen.getByRole('main'));
    const internal = main.getAllByRole('link', { name: 'Safety' })[0]!;
    expect(internal.getAttribute('href')).toBe('/docs/safety');
    expect(internal.getAttribute('target')).toBeNull();
    expect(main.getByRole('link', { name: 'Claude Code' }).getAttribute('target')).toBe('_blank');
  });

  it('explains both ways of running a spec', () => {
    render(<DocsPage pathname="/docs/running-specs" />);
    expect(screen.getByRole('heading', { name: 'Running a spec', level: 2 })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Why the chat is the main button' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Why the background run stays' })).toBeTruthy();
  });
});
