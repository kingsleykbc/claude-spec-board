import { DOCS_PAGES, docsLink, docsPath, pageForPath } from '../lib/docsPages';
import { Markdown } from './Markdown';
import s from './DocsPage.module.css';

/** The documentation: the repo's README and guide files, opened from the menu under the logo. */
export function DocsPage({ pathname }: { pathname: string }) {
  const page = pageForPath(pathname);
  return (
    <div className={s.page}>
      <nav className={s.nav} aria-label="Documentation">
        <h1 className={s.title}>Spec Board docs</h1>
        {DOCS_PAGES.map((p) => (
          <a key={p.slug} className={s.link} href={docsPath(p.slug)} aria-current={p.slug === page.slug ? 'page' : undefined}>
            {p.title}
          </a>
        ))}
      </nav>
      <main className={s.main}>
        <Markdown md={page.md} mapLink={docsLink} />
      </main>
    </div>
  );
}
