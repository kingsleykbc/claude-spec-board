import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { Project } from '@specboard/core';
import { recipeArchived, recipeSpecs } from './fixtures/recipeBox';
import type { Conn, LiveMessage } from './api/live';
import type { RunEvent, RunSnapshot, RunState, SyncProposal } from './api/client';

// Sync with code, from the logo menu and from a card: the API is mocked and the socket is driven by hand.

const live = vi.hoisted(() => ({
  onChange: null as null | ((initial: boolean) => void),
  onMessage: null as null | ((m: LiveMessage) => void),
}));
vi.mock('./api/live', () => ({
  connectLive: (_pid: string, onChange: (initial: boolean) => void, _onConn: (c: Conn) => void, onMessage: (m: LiveMessage) => void) => {
    Object.assign(live, { onChange, onMessage });
    return () => undefined;
  },
}));

const project: Project = {
  root: '/x/recipe-box',
  config: { name: 'Recipe Box', description: '', references: [] } as unknown as Project['config'],
  overview: null,
  settings: { trackTokens: true, problems: [] },
  specs: recipeSpecs,
  archived: recipeArchived,
  problems: [],
};

vi.mock('./api/client', async (orig) => ({
  ...(await orig<typeof import('./api/client')>()),
  api: {
    projects: vi.fn(async () => [{ id: 'p1', name: 'Recipe Box', root: '/x/recipe-box', progress: { done: 3, total: 9 } }]),
    project: vi.fn(async () => ({ entry: { id: 'p1', name: 'Recipe Box', root: '/x/recipe-box' }, project, nextId: 'T-110' })),
    getRun: vi.fn(),
    startRun: vi.fn(),
    stopRun: vi.fn(),
    dismissRun: vi.fn(),
    syncProposal: vi.fn(),
    discardSyncProposal: vi.fn(),
  },
}));

import { App } from './App';
import { api, ApiError } from './api/client';

const NONE: SyncProposal = { exists: false };
const waiting = (over: Partial<Extract<SyncProposal, { exists: true }>> = {}): SyncProposal => ({
  exists: true,
  head: 'a1b2c3d',
  changes: 3,
  created: '2026-11-14',
  scope: null,
  bodyMd: '1. Move T-106 to review',
  problems: [],
  ...over,
});

const run = (over: Partial<RunSnapshot> = {}): RunSnapshot => ({
  id: 'r1',
  pid: 'p1',
  kind: 'sync-plan',
  specId: null,
  status: 'running',
  lines: [],
  end: null,
  startedAt: '2026-11-14T10:00:00.000Z',
  dismissed: false,
  ...over,
});
const state = (r: RunSnapshot | null, over: Partial<RunState> = {}): RunState => ({
  run: r,
  claude: { installed: true, loggedIn: true, version: '2.0.0' },
  approved: true,
  ...over,
});

const send = (e: RunEvent) => act(() => live.onMessage!(e as unknown as LiveMessage));
const flush = () => act(async () => new Promise<void>((r) => setTimeout(r, 0)));

async function mount(url = '/?project=p1', over: Partial<RunState> = {}, first: RunSnapshot | null = null) {
  vi.mocked(api.getRun).mockResolvedValue(state(first, over));
  history.replaceState(null, '', url);
  render(<App />);
  await screen.findByRole('region', { name: 'Review' });
  await flush();
}
// The logo menu is a Radix dropdown: it opens on pointer-down or Enter, not on a bare click event.
const openMenu = () => fireEvent.keyDown(screen.getByRole('button', { name: 'Spec Board' }), { key: 'Enter' });
const syncDialog = () => screen.getByRole('dialog', { name: /Sync/ });

beforeEach(() => {
  for (const f of [api.getRun, api.startRun, api.stopRun, api.dismissRun, api.syncProposal, api.discardSyncProposal]) vi.mocked(f).mockReset();
  vi.mocked(api.syncProposal).mockResolvedValue(NONE);
  vi.mocked(api.discardSyncProposal).mockResolvedValue(undefined);
});
afterEach(cleanup);

describe('Sync with code from the logo menu', () => {
  it('manual mode: the dialog gives the command and starts nothing', async () => {
    await mount('/?project=p1', { approved: false });
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sync with code' }));
    expect(within(syncDialog()).getByText('Sync needs Claude')).toBeTruthy();
    expect(within(syncDialog()).getByText('/specboard:sync-specs')).toBeTruthy();
    expect(api.startRun).not.toHaveBeenCalled();
  });

  it('plans with a run, then shows the proposal with its change count; Cancel discards it', async () => {
    vi.mocked(api.startRun).mockResolvedValue({ run: run() });
    await mount();
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sync with code' }));
    await flush();
    expect(api.startRun).toHaveBeenCalledWith('p1', 'sync-plan', undefined);
    expect(within(syncDialog()).getByText('Claude is reading your code…')).toBeTruthy();
    send({ type: 'run-line', runId: 'r1', line: { seq: 1, k: 'read', text: 'Read', code: 'src/app.ts', time: '10:00' } });
    expect(within(syncDialog()).getByText('src/app.ts')).toBeTruthy();

    vi.mocked(api.syncProposal).mockResolvedValue(waiting());
    send({ type: 'run-ended', run: run({ status: 'finished', end: { status: 'finished' } }) });
    await flush();
    expect(within(syncDialog()).getByText('This will change 3 specs.')).toBeTruthy();
    expect(within(syncDialog()).getByText('Move T-106 to review')).toBeTruthy();
    expect(screen.getAllByText('Sync proposal ready').length).toBeGreaterThan(0);

    fireEvent.click(within(syncDialog()).getByRole('button', { name: 'Cancel' }));
    await flush();
    expect(api.discardSyncProposal).toHaveBeenCalledWith('p1');
    expect(screen.queryByRole('dialog', { name: /Sync/ })).toBeNull();
  });

  it('the watcher reload after a plan cannot strand the confirm view (its fetch lands after the plan’s own)', async () => {
    vi.mocked(api.startRun).mockResolvedValue({ run: run() });
    await mount();
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sync with code' }));
    await flush();
    const pending: ((p: SyncProposal) => void)[] = [];
    vi.mocked(api.syncProposal).mockImplementation(() => new Promise<SyncProposal>((r) => pending.push(r)));
    send({ type: 'run-ended', run: run({ status: 'finished', end: { status: 'finished' } }) }); // fetch B
    await act(async () => live.onChange!(false)); // project reload
    await flush(); // its proposal fetch A
    expect(pending.length).toBe(2);
    await act(async () => pending[0]!(waiting())); // B first
    await flush();
    await act(async () => pending[1]!(waiting())); // then A
    await flush();
    expect(within(syncDialog()).getByText('This will change 3 specs.')).toBeTruthy();
  });

  it('a finished plan whose proposal can’t be loaded says so', async () => {
    vi.mocked(api.startRun).mockResolvedValue({ run: run() });
    await mount();
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sync with code' }));
    await flush();
    vi.mocked(api.syncProposal).mockRejectedValue(new ApiError(500, 'boom'));
    send({ type: 'run-ended', run: run({ status: 'finished', end: { status: 'finished' } }) });
    await flush();
    expect(screen.getByText('Couldn’t load the sync proposal')).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: /Sync/ })).toBeNull();
  });

  it('while a project-level sync runs, a card’s Run note says Claude is syncing the board', async () => {
    await mount('/?project=p1&spec=T-104', {}, run());
    expect(screen.getAllByText('Claude is syncing the board with the code').length).toBeGreaterThan(0);
  });

  it('Confirm starts sync-apply, shows progress and closes on finish without deleting the proposal itself', async () => {
    vi.mocked(api.syncProposal).mockResolvedValue(waiting());
    vi.mocked(api.startRun).mockResolvedValue({ run: run({ id: 'r2', kind: 'sync-apply' }) });
    await mount();
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /Sync proposal waiting/ }));
    fireEvent.click(within(syncDialog()).getByRole('button', { name: 'Confirm' }));
    await flush();
    expect(api.startRun).toHaveBeenCalledWith('p1', 'sync-apply', undefined);
    expect(within(syncDialog()).getByText('Claude is updating your specs…')).toBeTruthy();
    send({ type: 'run-ended', run: run({ id: 'r2', kind: 'sync-apply', status: 'finished', end: { status: 'finished' } }) });
    await flush();
    expect(screen.queryByRole('dialog', { name: /Sync/ })).toBeNull();
    expect(screen.getByText('Board synced with the code')).toBeTruthy();
    expect(api.discardSyncProposal).not.toHaveBeenCalled();
  });

  it('a busy server: the existing refusal toast, and the dialog closes', async () => {
    vi.mocked(api.startRun).mockRejectedValue(new ApiError(409, 'busy', { run: run({ kind: 'run', specId: 'T-104' }) }));
    await mount();
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sync with code' }));
    await flush();
    expect(screen.getByText('Claude is already working on T-104')).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: /Sync/ })).toBeNull();
  });

  it('a waiting proposal does not pop up on load; the menu item appears only while the file exists', async () => {
    vi.mocked(api.syncProposal).mockResolvedValue(waiting());
    await mount();
    expect(screen.queryByRole('dialog', { name: /Sync/ })).toBeNull();
    openMenu();
    expect(screen.getByRole('menuitem', { name: /Sync proposal waiting/ })).toBeTruthy();

    // The file goes away: the watcher's change event refetches it.
    vi.mocked(api.syncProposal).mockResolvedValue(NONE);
    await act(async () => live.onChange!(false));
    await flush();
    expect(screen.queryByRole('menuitem', { name: /Sync proposal waiting/ })).toBeNull();
  });

  it('a scoped proposal is not in the logo menu', async () => {
    vi.mocked(api.syncProposal).mockResolvedValue(waiting({ scope: 'T-104' }));
    await mount();
    openMenu();
    expect(screen.queryByRole('menuitem', { name: /Sync proposal waiting/ })).toBeNull();
  });

  it('nothing to change: Close discards the proposal', async () => {
    vi.mocked(api.syncProposal).mockResolvedValue(waiting({ changes: 0 }));
    await mount();
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /Sync proposal waiting/ }));
    expect(within(syncDialog()).getByText('Nothing to change. The board already matches the code.')).toBeTruthy();
    fireEvent.click(within(syncDialog()).getByRole('button', { name: 'Close' }));
    await flush();
    expect(api.discardSyncProposal).toHaveBeenCalledWith('p1');
  });
});

describe('Sync one card from its detail', () => {
  it('the Sync button starts a scoped plan, titled with the spec', async () => {
    vi.mocked(api.startRun).mockResolvedValue({ run: run({ specId: 'T-104' }) });
    await mount('/?project=p1&spec=T-104');
    fireEvent.click(screen.getByRole('button', { name: 'Sync' }));
    await flush();
    expect(api.startRun).toHaveBeenCalledWith('p1', 'sync-plan', 'T-104');
    expect(within(syncDialog()).getByText('Sync T-104 with the code')).toBeTruthy();
  });

  it('manual mode gives the command with the spec ID', async () => {
    await mount('/?project=p1&spec=T-104', { approved: false });
    fireEvent.click(screen.getByRole('button', { name: 'Sync' }));
    expect(within(syncDialog()).getByText('/specboard:sync-specs T-104')).toBeTruthy();
  });

  it('is disabled while a run is active', async () => {
    await mount('/?project=p1&spec=T-104', {}, run({ kind: 'run', specId: 'T-105' }));
    expect((screen.getByRole('button', { name: 'Sync' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('its waiting proposal shows beside Sync and reopens the confirm view', async () => {
    vi.mocked(api.syncProposal).mockResolvedValue(waiting({ scope: 'T-104' }));
    await mount('/?project=p1&spec=T-104');
    fireEvent.click(screen.getByRole('button', { name: 'Sync proposal waiting' }));
    expect(within(syncDialog()).getByText('Sync T-104 with the code')).toBeTruthy();
    expect(within(syncDialog()).getByText('This will change 3 specs.')).toBeTruthy();
  });

  it('another card’s proposal does not show there', async () => {
    vi.mocked(api.syncProposal).mockResolvedValue(waiting({ scope: 'T-105' }));
    await mount('/?project=p1&spec=T-104');
    expect(screen.queryByRole('button', { name: 'Sync proposal waiting' })).toBeNull();
  });
});
