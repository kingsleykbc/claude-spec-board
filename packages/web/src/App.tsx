import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Spec, Status } from '@specboard/core';
import { api, type ProjectSummary } from './api/client';
import { applyTheme, initialTheme, type Theme } from './lib/theme';
import { createSpecActions, OFFLINE_TOAST } from './state/actions';
import { ESC, useEscape } from './lib/escape';
import { categoryOptions, NO_FILTERS, waitItems, type Filters, type WaitItem } from './state/filters';
import { createMutator } from './state/mutate';
import { useToasts, type PushToast } from './state/toasts';
import { useProject } from './state/useProject';
import { Board } from './components/Board';
import { CardDetail } from './components/detail/CardDetail';
import { ConnectionBanner } from './components/ConnectionBanner';
import { FilterBar, type FilterMenu } from './components/FilterBar';
import { Toasts } from './components/Toasts';
import { TopBar } from './components/TopBar';
import boardCss from './components/Board.module.css';

// URL state: ?project=<id> and ?spec=<id>, kept with history.pushState and popstate (no router).

export interface UrlState {
  project: string | null;
  spec: string | null;
}

export function readUrl(): UrlState {
  const q = new URLSearchParams(location.search);
  return { project: q.get('project'), spec: q.get('spec') };
}

function urlFor(next: UrlState): string {
  const q = new URLSearchParams(location.search);
  for (const k of ['project', 'spec'] as const) {
    const v = next[k];
    if (v) q.set(k, v);
    else q.delete(k);
  }
  const qs = q.toString();
  return location.pathname + (qs ? `?${qs}` : '') + location.hash;
}

/** The board card for a spec, to return focus to when its detail closes. */
function cardElement(id: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>('[role="button"][aria-label]')) {
    if (el.getAttribute('aria-label')!.startsWith(id + ' ')) return el;
  }
  return null;
}

type Navigate = (next: UrlState, replace?: boolean) => void;

const shell = { minHeight: '100vh', background: 'var(--bg)', color: 'var(--fg)', fontFamily: 'var(--sans)', fontSize: 14 } as const;
const muted = { padding: '24px 20px', color: 'var(--fg3)' } as const;

export function App() {
  const { toasts, push, dismiss } = useToasts();
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<UrlState>(readUrl);
  const [theme, setTheme] = useState<Theme>(initialTheme);

  const navigate = useCallback<Navigate>((next, replace = false) => {
    const href = urlFor(next);
    if (replace) history.replaceState(null, '', href);
    else history.pushState(null, '', href);
    setUrl(next);
  }, []);

  useEffect(() => {
    const onPop = () => setUrl(readUrl());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const loadProjects = useCallback(() => {
    api
      .projects()
      .then((list) => {
        setProjects(list);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, []);
  useEffect(loadProjects, [loadProjects]);

  const pid = projects ? (projects.find((p) => p.id === url.project)?.id ?? projects[0]?.id ?? null) : null;

  // No or unknown ?project= → show the first project and say so in the URL.
  useEffect(() => {
    if (pid && url.project !== pid) navigate({ project: pid, spec: url.project ? null : url.spec }, true);
  }, [pid, url, navigate]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark';
      applyTheme(next, true);
      return next;
    });
  }, []);

  let body;
  if (pid && projects) {
    body = (
      <ProjectView
        key={pid}
        pid={pid}
        spec={url.spec}
        projects={projects}
        navigate={navigate}
        toast={push}
        theme={theme}
        onToggleTheme={toggleTheme}
        reloadProjects={loadProjects}
      />
    );
  } else {
    body = <div style={muted}>{error ?? (projects ? 'No projects yet. Run spec-board in a project folder.' : 'Loading…')}</div>;
  }

  return (
    <div style={shell}>
      {body}
      <Toasts toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

interface ProjectViewProps {
  pid: string;
  /** `?spec=`: the open card detail. */
  spec: string | null;
  projects: ProjectSummary[];
  navigate: Navigate;
  toast: PushToast;
  theme: Theme;
  onToggleTheme: () => void;
  reloadProjects: () => void;
}

/** One project's board. Keyed by project ID, so filters and menus reset on a switch (pinned behaviour 4). */
function ProjectView({ pid, spec: openId, projects, navigate, toast, theme, onToggleTheme, reloadProjects }: ProjectViewProps) {
  const { data, conn, changed, refresh, error, reconnect } = useProject(pid);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [menu, setMenu] = useState<'switcher' | Exclude<FilterMenu, null> | null>(null);
  /** Optimistic status while a move is in flight, so the card does not snap back before the refresh. */
  const [pending, setPending] = useState<Record<string, Status>>({});
  const wantReconnectToast = useRef(false);

  const mutate = useMemo(() => createMutator(() => Promise.reject(new Error('No default op'))), []);
  const down = conn === 'disconnected';
  const downRef = useRef(down);
  downRef.current = down;
  const actions = useMemo(
    () => createSpecActions({ pid, mutate, refresh, toast, isDown: () => downRef.current }),
    [pid, mutate, refresh, toast],
  );

  useEffect(() => {
    if (conn === 'live' && wantReconnectToast.current) {
      wantReconnectToast.current = false;
      toast('ok', 'Reconnected', 'The board is up to date with your files.');
    }
  }, [conn, toast]);

  // Esc closes open menus (pinned behaviour 14), below dialogs and inputs in the Esc stack.
  useEscape(menu !== null, () => setMenu(null), ESC.menu);

  const summary = projects.find((p) => p.id === pid);
  const project = data?.project ?? null;
  const specs = useMemo(
    () => (project ? project.specs.map((x) => (pending[x.id] && pending[x.id] !== x.status ? { ...x, status: pending[x.id]! } : x)) : []),
    [project, pending],
  );
  const archived = project?.archived ?? [];
  const name = project?.config?.name || data?.entry.name || summary?.name || pid;
  const progress = project
    ? { done: archived.length + project.specs.filter((x) => x.status === 'done').length, total: project.specs.length + archived.length }
    : (summary?.progress ?? { done: 0, total: 0 });

  const openSpec = (id: string) => navigate({ project: pid, spec: id });
  const offline = () => toast('err', ...OFFLINE_TOAST);
  const closeSpec = () => navigate({ project: pid, spec: null });

  const move = async (spec: Spec, status: Status) => {
    if (down) return offline();
    setPending((p) => ({ ...p, [spec.id]: status }));
    try {
      await actions.move(spec, status);
    } finally {
      // Ruling 15a: a later move of the same spec may have set its own target; leave that one alone.
      setPending((p) => {
        if (p[spec.id] !== status) return p;
        const rest = { ...p };
        delete rest[spec.id];
        return rest;
      });
    }
  };

  const onWait = (w: WaitItem) => {
    if (w.kind === 'blocked') setFilters((f) => ({ ...f, blocked: !f.blocked }));
    else if (w.target) openSpec(w.target);
  };

  const openAdd = () => undefined; // the Add spec modal arrives in Task 12

  return (
    <>
      {menu && <div data-testid="menu-scrim" onClick={() => setMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 25 }} />}
      <TopBar
        switcher={{
          name,
          progress,
          projects: projects.map((p) => (p.id === pid ? { ...p, name, progress } : p)),
          current: pid,
          open: menu === 'switcher',
          onToggle: () => {
            if (menu !== 'switcher') reloadProjects();
            setMenu((m) => (m === 'switcher' ? null : 'switcher'));
          },
          onPick: (id) => {
            setMenu(null);
            if (id !== pid) navigate({ project: id, spec: null });
          },
          onOpenFolder: () => {
            setMenu(null);
            toast('info', 'Run spec-board in a project folder', 'It will appear in this list.');
          },
        }}
        conn={conn}
        theme={theme}
        onToggleTheme={onToggleTheme}
        onOpenRefs={() => undefined /* References modal: Task 11 */}
        onOpenOverview={() => undefined /* Overview modal: Task 11 */}
      />
      <ConnectionBanner
        conn={conn}
        onReconnect={() => {
          wantReconnectToast.current = true;
          reconnect();
        }}
      />
      {project ? (
        <>
          <FilterBar
            filters={filters}
            onChange={setFilters}
            categories={categoryOptions(specs, archived)}
            waits={waitItems(specs)}
            onWait={onWait}
            menu={menu === 'cat' || menu === 'urg' ? menu : null}
            onMenu={(m) => setMenu(m)}
          />
          <Board
            specs={specs}
            archived={archived}
            filters={filters}
            canDrag={!down}
            changed={changed}
            onMove={(s, k) => void move(s, k)}
            onOpen={openSpec}
            onArchive={(s) => (down ? offline() : void actions.archive(s))}
            onUnarchive={(s) => (down ? offline() : void actions.unarchive(s))}
            onWriteUp={(s) => void actions.writeUp(s)}
            onAdd={openAdd}
          />
          <button type="button" className={boardCss.fab} onClick={openAdd}>
            <span className={boardCss.fabPlus}>+</span>Add new spec
          </button>
          {openId && (
            <CardDetail
              key={openId}
              pid={pid}
              specId={openId}
              root={project.root}
              specs={specs}
              archived={archived}
              mutate={mutate}
              refresh={refresh}
              toast={toast}
              onMove={move}
              onClose={closeSpec}
              down={down}
              returnFocus={() => cardElement(openId)}
            />
          )}
        </>
      ) : (
        <div style={muted}>{error ? error.message : 'Loading…'}</div>
      )}
    </>
  );
}
