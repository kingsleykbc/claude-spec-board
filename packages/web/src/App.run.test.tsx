import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Project } from '@specboard/core';
import { fileProblemSpec, recipeArchived, recipeSpec, recipeSpecs } from './fixtures/recipeBox';
import type { Conn, LiveMessage } from './api/live';
import type { RunEvent, RunSnapshot, RunState } from './api/client';

// The board wired to real runs: the API is mocked and the socket is driven by hand.

const live = vi.hoisted(() => ({
  onConn: null as null | ((c: Conn) => void),
  onMessage: null as null | ((m: LiveMessage) => void),
  onOpen: null as null | (() => void),
}));
vi.mock('./api/live', () => ({
  connectLive: (_pid: string, _onChange: () => void, onConn: (c: Conn) => void, onMessage: (m: LiveMessage) => void, onOpen: () => void) => {
    Object.assign(live, { onConn, onMessage, onOpen });
    return () => undefined;
  },
}));

const project: Project = {
  root: '/x/recipe-box',
  config: { name: 'Recipe Box', description: '', references: [] } as unknown as Project['config'],
  overview: null,
  specs: [...recipeSpecs, fileProblemSpec],
  archived: recipeArchived,
  problems: [],
};

vi.mock('./api/client', async (orig) => ({
  ...(await orig<typeof import('./api/client')>()),
  api: {
    projects: vi.fn(async () => [{ id: 'p1', name: 'Recipe Box', root: '/x/recipe-box', progress: { done: 3, total: 9 } }]),
    project: vi.fn(async () => ({ entry: { id: 'p1', name: 'Recipe Box', root: '/x/recipe-box' }, project, nextId: 'T-110' })),
    createSpec: vi.fn(),
    getRun: vi.fn(),
    startRun: vi.fn(),
    stopRun: vi.fn(),
    dismissRun: vi.fn(),
  },
}));

import { App } from './App';
import { api, ApiError } from './api/client';

const run = (over: Partial<RunSnapshot> = {}): RunSnapshot => ({
  id: 'r1',
  pid: 'p1',
  kind: 'run',
  specId: 'T-104',
  status: 'running',
  lines: [],
  end: null,
  startedAt: '2026-11-09T10:00:00.000Z',
  dismissed: false,
  ...over,
});
const ended = (r: RunSnapshot, end: NonNullable<RunSnapshot['end']>): RunSnapshot => ({ ...r, status: end.status, end });
const state = (r: RunSnapshot | null, over: Partial<RunState> = {}): RunState => ({
  run: r,
  claude: { installed: true, loggedIn: true, version: '2.0.0' },
  approved: true,
  ...over,
});

const send = (e: RunEvent) => act(() => live.onMessage!(e as unknown as LiveMessage));
const flush = () => act(async () => new Promise<void>((r) => setTimeout(r, 0)));

/** Mount at `url`, with `first` as the run the server already has, and wait for the board. */
async function mount(first: RunSnapshot | null = null, url = '/?project=p1', over: Partial<RunState> = {}) {
  vi.mocked(api.getRun).mockResolvedValue(state(first, over));
  history.replaceState(null, '', url);
  render(<App />);
  await screen.findByRole('region', { name: 'Review' });
  await flush();
}
const named = (text: string) => screen.queryAllByText(text);
const panel = () => screen.queryByRole('complementary', { name: 'Run output' });
const runBtn = () => screen.getByRole('button', { name: /Tell Claude to start/ });

beforeEach(() => {
  vi.mocked(api.getRun).mockReset();
  vi.mocked(api.startRun).mockReset();
  vi.mocked(api.stopRun).mockReset();
  vi.mocked(api.dismissRun).mockReset();
  vi.mocked(api.createSpec).mockReset();
});
afterEach(cleanup);

describe('toasts come from live run events, once each', () => {
  it('run-started: "Claude started on <ID>" with the title, once even if the event repeats', async () => {
    await mount();
    send({ type: 'run-started', run: run() });
    send({ type: 'run-started', run: run() });
    expect(named('Claude started on T-104')).toHaveLength(1);
    // One on the card, one as the toast's sub-line.
    expect(named(recipeSpec('T-104').title)).toHaveLength(2);
  });

  it('own start() and the socket event together give one toast', async () => {
    vi.mocked(api.startRun).mockResolvedValue({ run: run() });
    await mount(null, '/?project=p1&spec=T-104');
    fireEvent.click(runBtn());
    await flush();
    send({ type: 'run-started', run: run() });
    expect(api.startRun).toHaveBeenCalledWith('p1', 'run', 'T-104');
    expect(named('Claude started on T-104')).toHaveLength(1);
  });

  it.each([
    ['write-up', 'Claude is writing up T-104'],
    ['fix-file', 'Asked Claude to fix T-104'],
  ] as const)('run-started of a %s run says "%s"', async (kind, text) => {
    await mount();
    send({ type: 'run-started', run: run({ kind }) });
    expect(named(text)).toHaveLength(1);
    expect(named('Claude started on T-104')).toHaveLength(0);
  });

  it('a refresh-overview start has no toast', async () => {
    await mount();
    send({ type: 'run-started', run: run({ kind: 'refresh-overview', specId: null }) });
    expect(screen.queryByText(/Claude (started|is writing)/)).toBeNull();
  });

  const endings: [RunSnapshot['kind'], RunSnapshot['status'], string][] = [
    ['run', 'finished', 'T-104 moved to Review'],
    ['run', 'stopped', 'Stopped Claude on T-104'],
    ['run', 'needs', 'Claude needs your answer on T-104'],
    ['run', 'permission', 'Claude stopped on T-104'],
    ['run', 'error', 'Run failed on T-104'],
    ['write-up', 'finished', 'Claude wrote up T-104'],
    ['write-up', 'stopped', 'Stopped Claude on T-104'],
    ['write-up', 'permission', 'Claude stopped on T-104'],
    ['write-up', 'error', 'Run failed on T-104'],
    ['fix-file', 'finished', 'T-104 is fixed'],
    ['fix-file', 'stopped', 'Stopped Claude on T-104'],
    ['fix-file', 'permission', 'Claude stopped on T-104'],
    ['fix-file', 'error', 'Run failed on T-104'],
  ];
  it.each(endings)('%s ending %s: "%s", once', async (kind, status, text) => {
    const held = run({ kind });
    await mount(held);
    const end = ended(held, { status });
    send({ type: 'run-ended', run: end });
    send({ type: 'run-ended', run: end });
    expect(named(text)).toHaveLength(1);
  });

  it.each([
    [{ status: 'finished' }, 'Claude finished. Have a look when you can.'],
    [{ status: 'stopped' }, 'Work so far is committed.'],
    [{ status: 'needs', text: 'There are 2 unanswered questions on this spec.' }, 'There are 2 unanswered questions on this spec.'],
    [{ status: 'error', title: 'Claude Code exited with code 2' }, 'Claude Code exited with code 2'],
  ] as const)('the sub-line of %j', async (end, sub) => {
    const held = run();
    await mount(held);
    send({ type: 'run-ended', run: ended(held, end) });
    expect(named(sub)).toHaveLength(1);
  });

  it('a subtask line toasts "<ID> · Subtask done" with its name, once; a repeat of the seq does not', async () => {
    await mount(run());
    const line = { seq: 1, k: 'done', text: 'Subtask 3 done: Persist planned meals · committed', code: 'abc', time: '10:00' } as const;
    send({ type: 'run-line', runId: 'r1', line });
    send({ type: 'run-line', runId: 'r1', line });
    expect(named('T-104 · Subtask done')).toHaveLength(1);
    expect(named('Persist planned meals')).toHaveLength(1);
  });

  it('other lines toast nothing, including the closing "All subtasks done" and a write-up\'s done line', async () => {
    await mount(run());
    send({ type: 'run-line', runId: 'r1', line: { seq: 1, k: 'read', text: 'Read', time: '10:00' } });
    send({ type: 'run-line', runId: 'r1', line: { seq: 2, k: 'done', text: 'All subtasks done · committed', code: 'abc', time: '10:00' } });
    expect(named('T-104 · Subtask done')).toHaveLength(0);
    cleanup();
    await mount(run({ kind: 'write-up' }));
    send({ type: 'run-line', runId: 'r1', line: { seq: 1, k: 'done', text: 'Spec written up', time: '10:00' } });
    expect(named('T-104 · Subtask done')).toHaveLength(0);
  });

  it('a snapshot on load fires nothing', async () => {
    await mount(ended(run({ lines: [{ seq: 1, k: 'done', text: 'Subtask 1 done: A', time: '10:00' }] }), { status: 'finished' }));
    expect(named('T-104 moved to Review')).toHaveLength(0);
    expect(named('T-104 · Subtask done')).toHaveLength(0);
    expect(named('Claude started on T-104')).toHaveLength(0);
  });

  it('a snapshot replayed after a reconnect fires nothing, and the state still catches up', async () => {
    const held = run();
    await mount(held, '/?project=p1&spec=T-104');
    const later = ended({ ...held, lines: [{ seq: 1, k: 'done', text: 'Subtask 1 done: A', time: '10:00' }] }, { status: 'finished' });
    vi.mocked(api.getRun).mockResolvedValue(state(later));
    await act(async () => live.onOpen!());
    await flush();
    expect(within(panel()!).getByTestId('run-chip').textContent).toBe('Finished');
    expect(named('T-104 moved to Review')).toHaveLength(0);
    expect(named('T-104 · Subtask done')).toHaveLength(0);
  });
});

describe('refusals', () => {
  const click = async (rejection: unknown) => {
    vi.mocked(api.startRun).mockRejectedValue(rejection);
    await mount(null, '/?project=p1&spec=T-104');
    fireEvent.click(runBtn());
    await flush();
  };

  it.each([
    ['not-approved', new ApiError(412, 'x', { setup: 'not-approved' }), 'This project isn’t set up for runs', 'Run `specboard init` in a terminal.'],
    ['logged-out', new ApiError(503, 'x', { claude: 'logged-out' }), 'Claude Code isn’t logged in', 'Run `claude` in a terminal and log in.'],
    ['not-installed', new ApiError(503, 'x', { claude: 'not-installed' }), 'Claude Code isn’t installed', 'Install Claude Code, then run again.'],
    ['other error', new ApiError(500, 'Disk full'), 'Couldn’t reach Claude for T-104', 'Disk full'],
    ['network', new TypeError('fetch failed'), 'Disconnected from the local server.', 'Edits won’t save until it’s back.'],
  ])('%s', async (_name, rejection, text, sub) => {
    await click(rejection);
    expect(named(sub)).toHaveLength(1);
    // The connection banner repeats the offline text; every other title is the toast alone.
    expect(named(text).length).toBeGreaterThan(0);
  });

  it('busy names the spec Claude is on', async () => {
    await click(new ApiError(409, 'busy', { run: run({ specId: 'T-103' }) }));
    // The toast, and the Run button's own note now that the busy run is adopted (without a "started" toast).
    expect(named('Claude is already working on T-103')).toHaveLength(2);
    expect(named('Claude started on T-103')).toHaveLength(0);
  });

  it('while disconnected: the offline toast and no request', async () => {
    await mount(null, '/?project=p1&spec=T-104');
    act(() => live.onConn!('disconnected'));
    fireEvent.click(runBtn());
    await flush();
    expect(api.startRun).not.toHaveBeenCalled();
    expect(named('Edits won’t save until it’s back.')).toHaveLength(1);
  });

  it('Ask Claude to fix while disconnected: the offline toast and no request', async () => {
    await mount(null, '/?project=p1&spec=T-109');
    act(() => live.onConn!('disconnected'));
    fireEvent.click(screen.getByRole('button', { name: 'Ask Claude to fix' }));
    await flush();
    expect(api.startRun).not.toHaveBeenCalled();
    expect(named('Edits won’t save until it’s back.')).toHaveLength(1);
  });

  it('two quick clicks send one start', async () => {
    let answer!: (v: { run: RunSnapshot }) => void;
    vi.mocked(api.startRun).mockImplementation(() => new Promise((r) => (answer = r)));
    await mount(null, '/?project=p1&spec=T-104');
    const btn = runBtn();
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(api.startRun).toHaveBeenCalledTimes(1);
    await act(async () => answer({ run: run() }));
  });
});

describe('the actions start the right kind', () => {
  it('Have Claude write this up: start write-up, toast, and the card shows it is writing', async () => {
    vi.mocked(api.startRun).mockResolvedValue({ run: run({ kind: 'write-up', specId: 'T-107' }) });
    await mount();
    const card = screen.getByRole('button', { name: /^T-107 / });
    fireEvent.click(within(card).getByRole('button', { name: /Have Claude write this up/ }));
    await flush();
    expect(api.startRun).toHaveBeenCalledWith('p1', 'write-up', 'T-107');
    expect(named('Claude is writing up T-107')).toHaveLength(1);
    expect(within(screen.getByRole('button', { name: /^T-107 / })).getByText('Claude is writing it up')).toBeTruthy();
  });

  it('Add & have Claude write it up: creates, then starts a write-up of the new spec', async () => {
    vi.mocked(api.createSpec).mockResolvedValue({ spec: { ...recipeSpec('T-107'), id: 'T-110', title: 'New' } });
    vi.mocked(api.startRun).mockResolvedValue({ run: run({ kind: 'write-up', specId: 'T-110' }) });
    await mount();
    fireEvent.click(screen.getByRole('button', { name: /Add new spec/ }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'New' } });
    fireEvent.click(screen.getByRole('button', { name: /Add & have Claude write it up/ }));
    await waitFor(() => expect(api.startRun).toHaveBeenCalledWith('p1', 'write-up', 'T-110'));
    await flush();
    expect(named('Claude is writing up T-110')).toHaveLength(1);
  });

  it('Ask Claude to fix: start fix-file and toast', async () => {
    vi.mocked(api.startRun).mockResolvedValue({ run: run({ kind: 'fix-file', specId: 'T-109' }) });
    await mount(null, '/?project=p1&spec=T-109');
    fireEvent.click(screen.getByRole('button', { name: 'Ask Claude to fix' }));
    await flush();
    expect(api.startRun).toHaveBeenCalledWith('p1', 'fix-file', 'T-109');
    expect(named('Asked Claude to fix T-109')).toHaveLength(1);
  });

  describe('Overview Refresh', () => {
    const refreshRun = run({ kind: 'refresh-overview', specId: null });
    const openOverview = () => fireEvent.click(screen.getByRole('button', { name: /Overview/ }));
    const refresh = async () => {
      vi.mocked(api.startRun).mockResolvedValue({ run: refreshRun });
      await mount();
      openOverview();
      fireEvent.click(screen.getByRole('button', { name: '↻ Refresh' }));
      await flush();
    };

    it('shows Refreshing while the run runs and "Overview updated" when it finishes', async () => {
      await refresh();
      expect(api.startRun).toHaveBeenCalledWith('p1', 'refresh-overview', undefined);
      expect(screen.getByRole('button', { name: 'Refreshing' })).toHaveProperty('disabled', true);
      expect(screen.getByText('Claude is rewriting the summary…')).toBeTruthy();
      send({ type: 'run-ended', run: ended(refreshRun, { status: 'finished' }) });
      expect(screen.getByRole('button', { name: '↻ Refresh' })).toHaveProperty('disabled', false);
      expect(screen.queryByText('Claude is rewriting the summary…')).toBeNull();
      expect(named('Overview updated')).toHaveLength(1);
    });

    it('a failed refresh says so and leaves Refreshing', async () => {
      await refresh();
      send({ type: 'run-ended', run: ended(refreshRun, { status: 'error', title: 'Claude Code exited with code 1' }) });
      expect(named('Couldn’t refresh the overview')).toHaveLength(1);
      expect(screen.getByRole('button', { name: '↻ Refresh' })).toBeTruthy();
    });

    it('stays Refreshing when the modal is reopened during the run', async () => {
      await refresh();
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      openOverview();
      expect(screen.getByRole('button', { name: 'Refreshing' })).toBeTruthy();
    });

    it('has no run panel on any spec, and disables Run with a note', async () => {
      vi.mocked(api.getRun).mockResolvedValue(state(refreshRun));
      history.replaceState(null, '', '/?project=p1&spec=T-104');
      render(<App />);
      await screen.findByText('Claude is already working on the overview');
      expect(panel()).toBeNull();
      expect(runBtn()).toHaveProperty('disabled', true);
    });

    it('while disconnected: the offline toast and no request', async () => {
      await mount();
      openOverview();
      act(() => live.onConn!('disconnected'));
      fireEvent.click(screen.getByRole('button', { name: '↻ Refresh' }));
      await flush();
      expect(api.startRun).not.toHaveBeenCalled();
      expect(named('Edits won’t save until it’s back.')).toHaveLength(1);
    });
  });
});

describe('the Run button, from the run state', () => {
  it('a run on this spec: Stop', async () => {
    await mount(run(), '/?project=p1&spec=T-104');
    expect(screen.getByRole('button', { name: 'Stop' })).toBeTruthy();
  });

  it('a run on another spec, even from another tab: disabled and names it', async () => {
    await mount(null, '/?project=p1&spec=T-104');
    send({ type: 'run-started', run: run({ id: 'r2', specId: 'T-103' }) });
    expect(screen.getByText('Claude is already working on T-103')).toBeTruthy();
    expect(runBtn()).toHaveProperty('disabled', true);
  });

  it('Claude Code not installed: the copy fallback', async () => {
    await mount(null, '/?project=p1&spec=T-104', { claude: { installed: false, loggedIn: false, version: null } });
    expect(screen.getByText('Claude Code not found')).toBeTruthy();
  });

  it('claude not loaded yet: ready', async () => {
    vi.mocked(api.getRun).mockReturnValue(new Promise(() => undefined));
    history.replaceState(null, '', '/?project=p1&spec=T-104');
    render(<App />);
    await screen.findByRole('dialog', { name: recipeSpec('T-104').title });
    expect(runBtn()).toHaveProperty('disabled', false);
  });

  it('Stop calls the server; a failure shows a toast and a 404 does not', async () => {
    vi.mocked(api.stopRun).mockRejectedValue(new ApiError(500, 'Boom'));
    await mount(run(), '/?project=p1&spec=T-104');
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    await flush();
    expect(api.stopRun).toHaveBeenCalledWith('p1', 'r1');
    expect(named('Couldn’t stop Claude on T-104')).toHaveLength(1);
    expect(named('Boom')).toHaveLength(1);
    cleanup();
    vi.mocked(api.stopRun).mockRejectedValue(new ApiError(404, 'gone'));
    await mount(run(), '/?project=p1&spec=T-104');
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    await flush();
    expect(named('Couldn’t stop Claude on T-104')).toHaveLength(0);
  });

  it('Stop with the network gone shows the offline toast', async () => {
    vi.mocked(api.stopRun).mockRejectedValue(new TypeError('fetch failed'));
    await mount(run(), '/?project=p1&spec=T-104');
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    await flush();
    expect(named('Edits won’t save until it’s back.')).toHaveLength(1);
  });
});

describe('the board cards', () => {
  const card = (id: string) => within(screen.getByRole('button', { name: new RegExp(`^${id} `) }));

  it('a run shows the current subtask on that card only, and clears when it ends', async () => {
    const held = run();
    await mount(held);
    const spec = recipeSpec('T-104');
    const title = spec.subtasks.find((t) => t.n === spec.currentSubtask)!.title;
    expect(card('T-104').getByText(`· ${title}`)).toBeTruthy();
    expect(card('T-103').queryByText(/Claude is working/)).toBeNull();
    send({ type: 'run-ended', run: ended(held, { status: 'stopped' }) });
    expect(card('T-104').queryByText(/Claude is working/)).toBeNull();
  });

  it('runActive feeds the subtask pill in the detail', async () => {
    await mount(run(), '/?project=p1&spec=T-104');
    expect(within(screen.getByRole('dialog')).getByText('In progress')).toBeTruthy();
  });

  it('a write-up shows writing, not the working banner, and no In progress pill', async () => {
    await mount(run({ kind: 'write-up' }), '/?project=p1&spec=T-104');
    expect(within(screen.getByRole('dialog')).queryByText('In progress')).toBeNull();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(card('T-104').getByText('Claude is writing it up')).toBeTruthy();
    expect(card('T-104').queryByText(/Claude is working/)).toBeNull();
  });
});

describe('the run panel in the detail', () => {
  const lineOne = { seq: 1, k: 'read', text: 'Read', code: 'CLAUDE.md', time: '10:00' } as const;

  it('shows while running with live lines, and after ending', async () => {
    const held = run({ lines: [lineOne] });
    await mount(held, '/?project=p1&spec=T-104');
    expect(within(panel()!).getByTestId('run-chip').textContent).toBe('Running');
    expect(within(panel()!).getByText('CLAUDE.md')).toBeTruthy();
    send({ type: 'run-line', runId: 'r1', line: { seq: 2, k: 'edit', text: 'Editing', code: 'a.ts', time: '10:01' } });
    expect(within(panel()!).getByText('a.ts')).toBeTruthy();
    send({ type: 'run-ended', run: ended(held, { status: 'stopped' }) });
    expect(within(panel()!).getByTestId('run-chip').textContent).toBe('Stopped');
  });

  it('is not shown on another spec, or when already dismissed', async () => {
    await mount(run(), '/?project=p1&spec=T-103');
    expect(panel()).toBeNull();
    cleanup();
    await mount(ended(run({ dismissed: true }), { status: 'stopped' }), '/?project=p1&spec=T-104');
    expect(panel()).toBeNull();
  });

  it('Dismiss calls the server and hides it; a failure shows a toast and keeps it', async () => {
    vi.mocked(api.dismissRun).mockRejectedValueOnce(new ApiError(500, 'Boom')).mockResolvedValue(undefined);
    await mount(ended(run(), { status: 'stopped' }), '/?project=p1&spec=T-104');
    fireEvent.click(within(panel()!).getByRole('button', { name: 'Dismiss' }));
    await flush();
    expect(named('Couldn’t dismiss the run')).toHaveLength(1);
    expect(panel()).toBeTruthy();
    fireEvent.click(within(panel()!).getByRole('button', { name: 'Dismiss' }));
    await flush();
    expect(api.dismissRun).toHaveBeenCalledWith('p1', 'r1');
    expect(panel()).toBeNull();
  });

  it('a permission end shows end.fix, and Copy rule copies it', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const fix = 'specboard allow "Bash(npm install:*)"\nspecboard allow "Bash(git status:*)"';
    await mount(ended(run(), { status: 'permission', title: 'Claude needs permission', text: 'Allow it.', fix }), '/?project=p1&spec=T-104');
    expect(within(panel()!).getByText('Run this in a terminal, then run again.')).toBeTruthy();
    await act(async () => void fireEvent.click(within(panel()!).getByRole('button', { name: 'Copy rule' })));
    expect(writeText).toHaveBeenCalledWith(fix);
  });

  it('Run again starts the same kind on the same spec', async () => {
    vi.mocked(api.startRun).mockResolvedValue({ run: run({ id: 'r2', kind: 'fix-file', startedAt: '2026-11-09T11:00:00.000Z' }) });
    await mount(ended(run({ kind: 'fix-file' }), { status: 'error', title: 'Failed' }), '/?project=p1&spec=T-104');
    fireEvent.click(within(panel()!).getByRole('button', { name: 'Run again' }));
    await flush();
    expect(api.startRun).toHaveBeenCalledWith('p1', 'fix-file', 'T-104');
    expect(within(panel()!).getByTestId('run-chip').textContent).toBe('Running');
  });

  it('a needs end: Go to question scrolls, and the questions stay answerable', async () => {
    const needs = ended(run({ specId: 'T-105' }), { status: 'needs', title: 'Claude has a question', text: 'There is 1 unanswered question on this spec.' });
    await mount(needs, '/?project=p1&spec=T-105');
    const scroller = document.querySelector<HTMLElement>('[data-detail-scroll]')!;
    const scrollTo = vi.fn();
    scroller.scrollTo = scrollTo as typeof scroller.scrollTo;
    expect(within(panel()!).getByText('Claude has a question')).toBeTruthy();
    fireEvent.click(within(panel()!).getByRole('button', { name: 'Go to question' }));
    expect(scrollTo).toHaveBeenCalled();
    const save = within(screen.getByRole('dialog')).getByRole('button', { name: 'Save changes' });
    expect(save).toHaveProperty('disabled', true);
    const yes = within(screen.getByRole('dialog')).getAllByRole('radio', { name: 'Yes' })[0]!;
    fireEvent.click(yes);
    expect(yes).toHaveProperty('checked', true);
    expect(save).toHaveProperty('disabled', false);
  });
});
