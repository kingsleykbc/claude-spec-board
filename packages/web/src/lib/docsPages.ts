// The documentation is plain Markdown in the repo, bundled at build time: the page and GitHub show the same files.
import readme from '../../../../README.md?raw';
import gettingStarted from '../../../../docs/guide/getting-started.md?raw';
import runningSpecs from '../../../../docs/guide/running-specs.md?raw';
import writingSpecs from '../../../../docs/guide/writing-specs.md?raw';
import commands from '../../../../docs/guide/commands.md?raw';
import safety from '../../../../docs/guide/safety.md?raw';

export const DOCS_PATH = '/docs';
export const docsPath = (slug: string): string => (slug === '' ? DOCS_PATH : `${DOCS_PATH}/${slug}`);

export interface DocsPage {
  /** '' is the README. */
  slug: string;
  title: string;
  md: string;
}

export const DOCS_PAGES: DocsPage[] = [
  { slug: '', title: 'Overview', md: readme },
  { slug: 'getting-started', title: 'Getting started', md: gettingStarted },
  { slug: 'running-specs', title: 'Running a spec', md: runningSpecs },
  { slug: 'writing-specs', title: 'Specs and questions', md: writingSpecs },
  { slug: 'commands', title: 'Commands', md: commands },
  { slug: 'safety', title: 'Safety', md: safety },
];

/** True on any documentation URL. */
export const isDocsPath = (pathname: string): boolean => pathname === DOCS_PATH || pathname.startsWith(`${DOCS_PATH}/`);

/** The page for a URL; an unknown one shows the README. */
export function pageForPath(pathname: string): DocsPage {
  const slug = pathname.slice(DOCS_PATH.length).replace(/^\/+|\/+$/g, '');
  return DOCS_PAGES.find((p) => p.slug === slug) ?? DOCS_PAGES[0]!;
}

/** A link between the Markdown files, as a link between these pages. Null for anything else, which stays as written. */
export function docsLink(href: string): string | null {
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('#')) return null;
  const m = /([^/#?]+)\.md(#.*)?$/i.exec(href);
  if (!m) return null;
  const name = m[1]!.toLowerCase();
  const page = DOCS_PAGES.find((p) => (name === 'readme' ? p.slug === '' : p.slug === name));
  return page ? docsPath(page.slug) + (m[2] ?? '') : null;
}
