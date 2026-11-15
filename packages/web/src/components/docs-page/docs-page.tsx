import { useEffect, useState } from 'react';
import { api, type ProjectSummary } from '@/api/client';
import { DOCS_PAGES, docsLink, docsPath, pageForPath } from '@/lib/docsPages';
import { useThemeChoice } from '@/lib/theme';
import { Markdown } from '@/components/ui/markdown/markdown';
import { boardHref, TopBar } from '@/components/top-bar/top-bar';

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
  const [themeChoice, setThemeChoice] = useThemeChoice();
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);

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
    <div className="min-h-screen bg-bg font-sans text-[14px] text-fg">
      <TopBar
        page="docs"
        {...(current && projects
          ? {
              switcher: {
                name: current.name,
                progress: current.progress,
                projects,
                current: current.id,
                onPick: (id: string) => go(boardHref(id)),
                onOpenFolder: () => {
                  go(keep(docsPath('getting-started'), kept));
                },
              },
            }
          : {})}
        themeChoice={themeChoice}
        onThemeChoice={setThemeChoice}
      />
      <div className="mx-auto box-border grid max-w-[1040px] grid-cols-[220px_minmax(0,1fr)] gap-8 px-5 py-8 font-sans text-fg [@media(max-width:720px)]:grid-cols-[minmax(0,1fr)] [@media(max-width:720px)]:gap-4 [@media(max-width:720px)]:p-4">
        <nav className="sticky top-[84px] flex flex-col gap-0.5 self-start [@media(max-width:720px)]:static" aria-label="Documentation">
          <h1 className="m-0 mb-2.5 px-2.5 text-[14px] font-bold">Spec Board docs</h1>
          {DOCS_PAGES.map((p) => (
            <a key={p.slug} className="rounded-[7px] px-2.5 py-[7px] text-[13.5px] text-fg2 no-underline hover:bg-panel aria-[current=page]:bg-panel aria-[current=page]:font-semibold aria-[current=page]:text-fg" href={keep(docsPath(p.slug), kept)} aria-current={p.slug === page.slug ? 'page' : undefined}>
              {p.title}
            </a>
          ))}
        </nav>
        <main className="min-w-0 pb-16 [&_a]:text-accent-ink">
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
