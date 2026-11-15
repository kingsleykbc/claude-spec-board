import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { DOCS_PAGES, docsLink, isDocsPath, pageForPath } from '../lib/docsPages';
import { DocsPage } from './DocsPage';
import { headingId } from '@/components/ui/markdown/markdown';

afterEach(cleanup);

const noProjects = async () => [];

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

  it('don’t claim an npm install works', () => {
    const readme = DOCS_PAGES[0]!.md;
    expect(readme).toMatch(/isn't published to npm/);
    expect(DOCS_PAGES.flatMap((p) => p.md.split('\n')).filter((l) => /^\s*npx /.test(l))).toEqual([]);
  });
});

describe('the manual notice link', () => {
  it('lands on a heading that exists on the running-specs page', () => {
    const md = DOCS_PAGES.find((p) => p.slug === 'running-specs')!.md;
    expect(md).toMatch(/^## Turn on background runs$/m);
    expect(headingId('Turn on background runs')).toBe('turn-on-background-runs');
  });
});

describe('DocsPage', () => {
  it('shows the README first, with every page in the nav', () => {
    render(<DocsPage loadProjects={noProjects} pathname="/docs" />);
    expect(screen.getByRole('heading', { name: 'Spec Board', level: 2 })).toBeTruthy();
    const nav = within(screen.getByRole('navigation', { name: 'Documentation' }));
    expect(nav.getAllByRole('link').map((a) => a.textContent)).toEqual(DOCS_PAGES.map((p) => p.title));
    expect(nav.getByRole('link', { name: 'Overview' }).getAttribute('aria-current')).toBe('page');
  });

  it('keeps links between pages in this tab, and sends others to a new one', () => {
    render(<DocsPage loadProjects={noProjects} pathname="/docs" />);
    const main = within(screen.getByRole('main'));
    const internal = main.getAllByRole('link', { name: 'Safety' })[0]!;
    expect(internal.getAttribute('href')).toBe('/docs/safety');
    expect(internal.getAttribute('target')).toBeNull();
    expect(main.getByRole('link', { name: 'Claude Code' }).getAttribute('target')).toBe('_blank');
  });

  it('explains both ways of running a spec', () => {
    render(<DocsPage loadProjects={noProjects} pathname="/docs/running-specs" />);
    expect(screen.getByRole('heading', { name: 'Running a spec', level: 2 })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Why the chat is the usual choice' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Why the background run stays' })).toBeTruthy();
  });
});

describe('DocsPage top bar', () => {
  const list = [
    { id: 'a1', name: 'Recipe Box', root: 'C:/p/recipe-box', available: true, progress: { done: 3, total: 9 } },
    { id: 'b2', name: 'Other', root: 'C:/p/other', available: true, progress: { done: 0, total: 0 } },
  ];

  it('shows the project the docs were opened from, and keeps it on links between pages', async () => {
    render(<DocsPage pathname="/docs" search="?project=b2" loadProjects={async () => list} />);
    expect(await screen.findByRole('button', { name: /Other/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open the board' }).getAttribute('href')).toBe('/?project=b2');
    const nav = within(screen.getByRole('navigation', { name: 'Documentation' }));
    expect(nav.getByRole('link', { name: 'Safety' }).getAttribute('href')).toBe('/docs/safety?project=b2');
    const main = within(screen.getByRole('main'));
    expect(main.getAllByRole('link', { name: 'Safety' })[0]!.getAttribute('href')).toBe('/docs/safety?project=b2');
  });

  it('picking a project opens its board; Esc closes the menu', async () => {
    const go = vi.fn();
    render(<DocsPage pathname="/docs" loadProjects={async () => list} go={go} />);
    fireEvent.click(await screen.findByRole('button', { name: /Recipe Box/ }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menuitemradio', { name: /Other/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Recipe Box/ }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Other/ }));
    expect(go).toHaveBeenCalledWith('/?project=b2');
  });

  it('the server is not running: the docs still show, without a project switcher', async () => {
    render(<DocsPage pathname="/docs" loadProjects={() => Promise.reject(new Error('offline'))} />);
    expect(screen.getByRole('heading', { name: 'Spec Board', level: 2 })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open the board' }).getAttribute('href')).toBe('/');
    await Promise.resolve();
    expect(screen.queryByRole('button', { name: /Recipe Box/ })).toBeNull();
  });
});
