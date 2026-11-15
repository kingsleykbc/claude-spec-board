import { useEffect, useState } from 'react';
import { api, type ProjectSummary } from '../api/client';
import { DOCS_PAGES, docsLink, docsPath, pageForPath } from '../lib/docsPages';
import { ESC, useEscape } from '../lib/escape';
import { applyTheme, initialTheme, type Theme } from '../lib/theme';
import { Markdown } from '@/components/ui/markdown/markdown';
import { boardHref, TopBar } from './TopBar';
import s from './DocsPage.module.css';

export interface DocsPageProps {
  pathname: string;
  /** `?project=<id>`: the project the docs were opened from, kept on links between pages. */
  search?: string;
  /** Where the top bar gets the project list (tests pass their own). */
  loadProjects?: () => Promise<ProjectSummary[]>;
  /** Leave the docs for a URL (tests watch it). */
  go?: (href: string) => void;
}

/** `/docs/safety#x` with `?project=…` kept, before any `#`. */
function keep(href: string, search: string): string {
  if (!search) return href;
  const i = href.indexOf('#');
  return i < 0 ? href + search : href.slice(0, i) + search + href.slice(i);
}

/** The documentation: the repo's README and guide files, opened from the menu under the logo, under the same top bar as the board. */
export function DocsPage({ pathname, search = '', loadProjects = api.projects, go = (href) => location.assign(href) }: DocsPageProps) {
  const page = pageForPath(pathname);
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [menu, setMenu] = useState<'brand' | 'switcher' | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  useEscape(menu !== null, () => setMenu(null), ESC.menu);

  useEffect(() => {
    let alive = true;
    // Without the server the docs still read fine: the bar just has no project switcher.
    loadProjects().then(
      (list) => {
        if (alive) setProjects(list);
      },
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [loadProjects]);

  // A link like /docs/running-specs#turn-on-background-runs lands on its heading.
  useEffect(() => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (id) document.getElementById(id)?.scrollIntoView?.();
  }, [page.slug]);

  const wanted = new URLSearchParams(search).get('project');
  const current = projects?.find((p) => p.id === wanted) ?? projects?.[0];
  const kept = current ? `?project=${encodeURIComponent(current.id)}` : '';

  return (
    <div className={s.shell}>
      {menu && <div data-testid="menu-scrim" className={s.scrim} onClick={() => setMenu(null)} />}
      <TopBar
        page="docs"
        {...(current && projects
          ? {
              switcher: {
                name: current.name,
                progress: current.progress,
                projects,
                current: current.id,
                open: menu === 'switcher',
                onToggle: () => setMenu((m) => (m === 'switcher' ? null : 'switcher')),
                onPick: (id: string) => {
                  setMenu(null);
                  go(boardHref(id));
                },
                onOpenFolder: () => {
                  setMenu(null);
                  go(keep(docsPath('getting-started'), kept));
                },
              },
            }
          : {})}
        brandOpen={menu === 'brand'}
        onToggleBrand={() => setMenu((m) => (m === 'brand' ? null : 'brand'))}
        theme={theme}
        onToggleTheme={() =>
          setTheme((t) => {
            const next = t === 'dark' ? 'light' : 'dark';
            applyTheme(next, true);
            return next;
          })
        }
      />
      <div className={s.page}>
        <nav className={s.nav} aria-label="Documentation">
          <h1 className={s.title}>Spec Board docs</h1>
          {DOCS_PAGES.map((p) => (
            <a key={p.slug} className={s.link} href={keep(docsPath(p.slug), kept)} aria-current={p.slug === page.slug ? 'page' : undefined}>
              {p.title}
            </a>
          ))}
        </nav>
        <main className={s.main}>
          <Markdown
            md={page.md}
            mapLink={(href) => {
              const to = docsLink(href);
              return to === null ? null : keep(to, kept);
            }}
          />
        </main>
      </div>
    </div>
  );
}
