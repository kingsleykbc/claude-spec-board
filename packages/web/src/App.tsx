import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Spec, Status } from '@specboard/core';
import { api, type ProjectSummary } from './api/client';
import { useThemeChoice, type ThemeChoice } from './lib/theme';
import { createSpecActions, OFFLINE_TOAST } from './state/actions';
import { interceptPop } from './lib/popGuard';
import { PlusIcon } from './lib/icons';
import { runHold } from './lib/vm';
import { loadMode } from './lib/mode';
import { startTour, tourSeen } from './lib/tour';
import { currentMilestone } from '@specboard/core/milestones';
import { categoryOptions, effectiveMilestone, milestoneOptions, NO_FILTERS, waitItems, type Filters, type WaitItem } from './state/filters';
import { createMutator } from './state/mutate';
import { FileLinks } from './state/fileLinks';
import { initialSimple, saveSimple, SimpleMode } from './state/simpleMode';
import { initialView, saveView, type View } from './state/viewMode';
import { useToasts, type PushToast } from './state/toasts';
import { useProject } from './state/useProject';
import { cardRun, isRefreshing, manualReason, runButtonState, useRunActions, useRunToasts } from './state/runUi';
import { useRun } from './state/useRun';
import { useSync } from './state/useSync';
import { SyncDialog } from '@/components/sync-dialog/sync-dialog';
import { Board } from './components/board/board';
import { TableView } from './components/table-view/table-view';
import { AppSkeleton, BoardSkeleton } from '@/components/ui/skeleton/skeleton';
import { AddSpecModal } from '@/components/add-spec-modal/add-spec-modal';
import { CardDetail } from '@/components/card-detail/card-detail';
import { RunPanel } from '@/components/card-detail/run-panel/run-panel';
import { ConnectionBanner } from '@/components/connection-banner/connection-banner';
import { FilterBar } from './components/filter-bar/filter-bar';
import { TooltipProvider } from './components/ui/tooltip/tooltip';
import { LogsModal } from '@/components/logs-modal/logs-modal';
import { OverviewModal } from '@/components/overview-modal/overview-modal';
import { ReferencesModal } from '@/components/references-modal/references-modal';
import { SettingsModal } from '@/components/settings-modal/settings-modal';
import { Toasts } from '@/components/ui/toasts/toasts';
import { TopBar } from '@/components/top-bar/top-bar';
import { Footer } from '@/components/footer/footer';

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

// The app's base type: tokens' font and colours, 14px (line height comes from app.css).
const shell = 'min-h-screen bg-bg font-sans text-[14px] text-fg';
const muted = 'px-5 py-6 text-fg3';

export function App() {
  const { toasts, push, dismiss } = useToasts();
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<UrlState>(readUrl);
  // The theme choice; while it is System, an OS light/dark change re-applies it.
  const [themeChoice, setThemeChoice] = useThemeChoice();
  const [simple, setSimple] = useState<boolean>(initialSimple);
  const toggleSimple = useCallback((on: boolean) => {
    saveSimple(on);
    setSimple(on);
  }, []);

  const navigate = useCallback<Navigate>((next, replace = false) => {
    const href = urlFor(next);
    if (replace) history.replaceState(null, '', href);
    else history.pushState(null, '', href);
    setUrl(next);
  }, []);

  // The URL the app is showing, for putting it back when a Back/Forward is held for unsaved work.
  const shown = useRef(url);
  shown.current = url;

  useEffect(() => {
    const onPop = () => {
      const next = readUrl();
      // F3b: unsaved work in the open detail. Put the shown URL back, ask, and go on only after Discard.
      const held = interceptPop(() => navigate(next));
      if (held) history.pushState(null, '', urlFor(shown.current));
      else setUrl(next);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [navigate]);

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
  useEffect(() => void loadMode(), []); // plugin or repo: picks the wording of setup hints

  const pid = projects ? (projects.find((p) => p.id === url.project)?.id ?? projects[0]?.id ?? null) : null;

  // No or unknown ?project= → show the first project and say so in the URL.
  useEffect(() => {
    if (pid && url.project !== pid) navigate({ project: pid, spec: url.project ? null : url.spec }, true);
  }, [pid, url, navigate]);

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
        themeChoice={themeChoice}
        onThemeChoice={setThemeChoice}
        simple={simple}
        onSimple={toggleSimple}
        reloadProjects={loadProjects}
      />
    );
  } else {
    body = error || projects ? <div className={muted}>{error ?? 'No projects yet. Run spec-board in a project folder.'}</div> : <AppSkeleton />;
  }

  // Its own TooltipProvider (main.tsx gives DocsPage one), so icon-only controls' tooltips work wherever App is rendered.
  return (
    <TooltipProvider>
      <div className={shell}>
        {body}
        <Toasts toasts={toasts} onDismiss={dismiss} />
      </div>
    </TooltipProvider>
  );
}

interface ProjectViewProps {
  pid: string;
  /** `?spec=`: the open card detail. */
  spec: string | null;
  projects: ProjectSummary[];
  navigate: Navigate;
  toast: PushToast;
  themeChoice: ThemeChoice;
  onThemeChoice: (choice: ThemeChoice) => void;
  /** Simple mode (the switch in the top bar). */
  simple: boolean;
  onSimple: (on: boolean) => void;
  reloadProjects: () => void;
}

/** One project's board. Keyed by project ID, so filters and menus reset on a switch (pinned behaviour 4). */
function ProjectView({ pid, spec: openId, projects, navigate, toast, themeChoice, onThemeChoice, simple, onSimple, reloadProjects }: ProjectViewProps) {
  const { data, conn, live, changed, newQuestions, refresh, applyWrite, error, reconnect, loads } = useProject(pid);
  const run = useRun(pid, live);
  /** New-question badges cleared by saving answers (useProject keeps the session's full set). */
  const [seenQuestions, setSeenQuestions] = useState<ReadonlySet<string>>(() => new Set());
  const unseenQuestions = useMemo(() => new Set([...newQuestions].filter((k) => !seenQuestions.has(k))), [newQuestions, seenQuestions]);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [view, setView] = useState<View>(initialView);
  const pickView = (v: View) => {
    saveView(v);
    setView(v);
  };
  /** Optimistic status while a move is in flight, so the card does not snap back before the refresh. */
  const [pending, setPending] = useState<Record<string, Status>>({});
  const wantReconnectToast = useRef(false);
  /** The References, Overview, Logs, Settings or Add spec modal. */
  const [modal, setModal] = useState<'refs' | 'overview' | 'logs' | 'settings' | 'add' | null>(null);
  /** Where focus goes when a modal opened from the logo menu closes: the menu's item is gone by then, so the logo button. */
  const logoButton = () => document.querySelector<HTMLElement>('[data-tour="brand"]');
  /** The header's Logs button, for Logs opened from the Overview (whose "View all logs" is gone by then). */
  const logsButton = () => document.querySelector<HTMLElement>('[data-header="logs"]') ?? logoButton();

  const mutate = useMemo(() => createMutator(() => Promise.reject(new Error('No default op')), applyWrite), [applyWrite]);
  const down = conn === 'disconnected';
  const actions = useMemo(() => createSpecActions({ pid, mutate, refresh, toast }), [pid, mutate, refresh, toast]);

  useEffect(() => {
    if (conn === 'live' && wantReconnectToast.current) {
      wantReconnectToast.current = false;
      toast('ok', 'Reconnected', 'The board is up to date with your files.');
    }
  }, [conn, toast]);

  const summary = projects.find((p) => p.id === pid);
  const project = data?.project ?? null;
  const specs = useMemo(
    () => (project ? project.specs.map((x) => (pending[x.id] && pending[x.id] !== x.status ? { ...x, status: pending[x.id]! } : x)) : []),
    [project, pending],
  );
  const archived = project?.archived ?? [];
  const milestones = project?.config?.milestones ?? [];
  // The milestone filter starts at the current milestone once per project load (archived counted as done);
  // after that it is the person's choice until the project changes (ProjectView is keyed by project).
  const current = project ? currentMilestone([...project.specs, ...project.archived.map((x) => ({ ...x, status: 'done' as const }))], milestones) : null;
  const [milestoneSet, setMilestoneSet] = useState(false);
  if (project && !milestoneSet) {
    setMilestoneSet(true);
    if (milestones.length > 0) setFilters((f) => ({ ...f, milestone: current }));
  }
  const msOptions = milestoneOptions(specs, archived, milestones);
  // A chosen milestone that is gone (the config changed) falls back to the current one.
  const boardFilters = { ...filters, milestone: effectiveMilestone(filters.milestone, msOptions, current) };
  useRunToasts(run, specs, toast);
  const { startRun, stopRun, dismissRun } = useRunActions(run, toast, project?.root);
  const manual = manualReason(run.claude, run.approved);
  const sync = useSync({ pid, stamp: loads, run: run.run, manual: manual !== null, startRun, stopRun: () => void stopRun(), toast });
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

  // The first-time tour starts once the board is on screen, unless a card or a modal is open.
  const boardShown = !!project && !openId;
  useEffect(() => {
    if (!boardShown || tourSeen()) return;
    const t = setTimeout(() => startTour(simple), 400);
    return () => clearTimeout(t);
  }, [boardShown]);

  const openAdd = () => setModal('add');
  const closeModal = () => setModal(null);

  // The run panel of the open spec. Refresh-overview runs have no spec, so no panel: the Overview modal shows them.
  const shownRun = run.run && run.run.specId === openId && !run.run.dismissed ? run.run : null;
  const openDoc = specs.find((x) => x.id === openId);

  return (
    <>
      <TopBar
        switcher={{
          name,
          progress,
          projects: projects.map((p) => (p.id === pid ? { ...p, name, progress } : p)),
          current: pid,
          onOpen: reloadProjects,
          onPick: (id) => {
            if (id !== pid) navigate({ project: id, spec: null });
          },
          onOpenFolder: () => {
            toast('info', 'Run spec-board in a project folder', 'It will appear in this list.');
          },
        }}
        manual={manual}
        onSync={() => sync.openSync(null)}
        syncWaiting={!!sync.proposal && sync.proposal.scope === null}
        onSyncWaiting={sync.openWaiting}
        simple={simple}
        onSimple={onSimple}
        conn={conn}
        themeChoice={themeChoice}
        onThemeChoice={onThemeChoice}
        onOpenRefs={() => setModal('refs')}
        onOpenOverview={() => setModal('overview')}
        onOpenLogs={() => setModal('logs')}
        onSettings={() => setModal('settings')}
        onTour={() => {
          if (openId) closeSpec();
          setModal(null);
          setTimeout(() => startTour(simple), 0);
        }}
      />
      <ConnectionBanner
        conn={conn}
        onReconnect={() => {
          wantReconnectToast.current = true;
          reconnect();
        }}
      />
      {project ? (
        <SimpleMode value={simple}>
        <FileLinks pid={pid} root={project.root} toast={toast}>
          <FilterBar
            filters={boardFilters}
            onChange={setFilters}
            categories={categoryOptions(specs, archived)}
            waits={waitItems(specs)}
            onWait={onWait}
            simple={simple}
            view={view}
            onView={pickView}
            milestones={msOptions}
          />
          {view === 'table' ? (
            <TableView
              specs={specs}
              archived={archived}
              filters={filters}
              milestones={milestones}
              simple={simple}
              trackTokens={project.settings.trackTokens}
              onOpen={openSpec}
            />
          ) : (
          <Board
            specs={specs}
            archived={archived}
            filters={boardFilters}
            milestones={milestones}
            run={run.run}
            canDrag={!down}
            changed={changed}
            onMove={(s, k) => void move(s, k)}
            onOpen={openSpec}
            onArchive={(s) => (down ? offline() : void actions.archive(s))}
            onUnarchive={(s) => (down ? offline() : void actions.unarchive(s))}
            onWriteUp={(s) => void startRun('write-up', s.id)}
            onAdd={openAdd}
          />
          )}
          {/* Bottom right, above the footer. On phones it shrinks to a round + (the label stays for screen readers). */}
          <button
            type="button"
            className="fixed right-6 bottom-6 z-20 flex h-[42px] cursor-pointer items-center gap-2 rounded-xl border-0 bg-accent py-0 pr-[18px] pl-3.5 text-sm font-semibold whitespace-nowrap text-accent-fg shadow-[0_8px_24px_oklch(0.63_0.18_42/0.3)] hover:bg-accent-hover max-[640px]:right-4 max-[640px]:bottom-4 max-[640px]:size-12 max-[640px]:justify-center max-[640px]:gap-0 max-[640px]:overflow-hidden max-[640px]:rounded-full max-[640px]:p-0 max-[640px]:text-[0px]"
            aria-label="Add new spec"
            onClick={openAdd}
            data-tour="add"
          >
            <PlusIcon aria-hidden className="text-[17px] leading-none font-medium max-[640px]:text-[22px]" />
            Add new spec
          </button>
          <Footer />
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
              onOpenSpec={openSpec}
              changed={changed}
              newQuestions={unseenQuestions}
              onQuestionsSeen={(keys) => setSeenQuestions((x) => new Set([...x, ...keys]))}
              down={down}
              {...runButtonState(run.run, openId, run.claude)}
              runActive={openDoc ? cardRun(run.run, openDoc).runActive : false}
              onRun={() => void startRun('run', openId)}
              onStop={() => void stopRun()}
              onFixFile={() => void startRun('fix-file', openId)}
              onSync={() => sync.openSync(openId)}
              syncWaiting={sync.proposal?.scope === openId}
              onSyncWaiting={sync.openWaiting}
              {...(shownRun
                ? {
                    aside: (goToQuestions: () => void) => (
                      <RunPanel
                        kind={shownRun.kind}
                        status={shownRun.status}
                        lines={shownRun.lines}
                        end={shownRun.end}
                        projectRoot={project.root}
                        onDismiss={() => void dismissRun()}
                        onAction={(a) => {
                          if (a === 'question') goToQuestions();
                          else if (a === 'rerun') {
                            const hold = shownRun.kind === 'run' && openDoc ? runHold(openDoc, [...specs, ...archived]) : null;
                            if (hold) toast('warn', `${openId} can’t start yet`, hold);
                            else void startRun(shownRun.kind, openId);
                          }
                        }}
                      />
                    ),
                  }
                : {})}
              returnFocus={() => cardElement(openId)}
            />
          )}
          {modal === 'overview' && (
            <OverviewModal
              project={{ ...project, specs }}
              name={name}
              toast={toast}
              refreshing={isRefreshing(run.run)}
              onRefresh={() => void startRun('refresh-overview')}
              onOpenLogs={() => setModal('logs')}
              onClose={closeModal}
              returnFocus={logoButton}
            />
          )}
          {modal === 'logs' && (
            <LogsModal
              project={{ ...project, specs }}
              onOpenSpec={(id) => {
                closeModal();
                openSpec(id);
              }}
              onOpenOverview={() => setModal('overview')}
              onClose={closeModal}
              returnFocus={logsButton}
            />
          )}
          {modal === 'settings' && <SettingsModal pid={pid} trackTokens={project.settings.trackTokens} toast={toast} onClose={closeModal} returnFocus={logoButton} />}
          {sync.dialog && <SyncDialog {...sync.dialog} toast={toast} returnFocus={logoButton} />}
          {modal === 'refs' && <ReferencesModal pid={pid} toast={toast} down={down} stamp={project} onClose={closeModal} returnFocus={logoButton} />}
          {modal === 'add' && data && (
            <AddSpecModal
              pid={pid}
              nextId={data.nextId}
              toast={toast}
              down={down}
              refresh={refresh}
              onWriteUp={async (s) => void (await startRun('write-up', s.id))}
              onClose={closeModal}
            />
          )}
        </FileLinks>
        </SimpleMode>
      ) : (
        error ? <div className={muted}>{error.message}</div> : <BoardSkeleton />
      )}
    </>
  );
}
