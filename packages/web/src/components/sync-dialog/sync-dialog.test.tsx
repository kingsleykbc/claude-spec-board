import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { composeStories } from '@storybook/react-vite';
import type { RunLine } from '@/api/client';
import { type SyncDialogProps, type WaitingProposal } from './sync-dialog';
import * as stories from './sync-dialog.stories';

const { Manual } = composeStories(stories);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const proposal = (over: Partial<WaitingProposal> = {}): WaitingProposal => ({
  exists: true,
  head: 'a1b2c3d',
  changes: 3,
  created: '2026-11-14',
  scope: null,
  bodyMd: '1. Move T-106 to review\n2. Archive T-090',
  problems: [],
  ...over,
});

const LINES: RunLine[] = [
  { seq: 1, k: 'start', text: 'Started checking the board against the code', time: '10:00' },
  { seq: 2, k: 'read', text: 'Read', code: 'specs/T-104-meal-planner.md', time: '10:01' },
];

const setup = (over: Partial<SyncDialogProps> = {}) => {
  const props: SyncDialogProps = {
    scope: null,
    view: { kind: 'manual' },
    toast: vi.fn(),
    onStop: vi.fn(),
    onDiscard: vi.fn(),
    onConfirm: vi.fn(),
    onClose: vi.fn(),
    ...over,
  };
  // The story types its handlers as mocks; any handler does here.
  render(<Manual {...(props as Parameters<typeof Manual>[0])} />);
  return props;
};
const dialog = () => screen.getByRole('dialog');

describe('SyncDialog: manual mode', () => {
  it('explains it needs Claude and gives the project command to copy, with a toast once copied', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const p = setup();
    expect(within(dialog()).getByText('Sync needs Claude')).toBeTruthy();
    expect(within(dialog()).getByText('/specboard:sync-specs')).toBeTruthy();
    await act(async () => fireEvent.click(within(dialog()).getByRole('button', { name: /Copy/ })));
    expect(writeText).toHaveBeenCalledWith('/specboard:sync-specs');
    expect(p.toast).toHaveBeenCalledWith('ok', 'Command copied', 'Paste it into a Claude chat open in this project.');
  });

  it('a scoped sync gives the command with the spec ID', () => {
    setup({ scope: 'T-104' });
    expect(within(dialog()).getByText('/specboard:sync-specs T-104')).toBeTruthy();
  });

  it('a refused copy says so and shows the command', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn(async () => Promise.reject(new Error('no'))) }, configurable: true });
    const p = setup();
    await act(async () => fireEvent.click(within(dialog()).getByRole('button', { name: /Copy/ })));
    expect(p.toast).toHaveBeenCalledWith('err', 'Couldn’t copy the command', '/specboard:sync-specs');
  });
});

describe('SyncDialog: running', () => {
  it('shows Claude reading the code with the live lines, and Stop stops it', () => {
    const p = setup({ view: { kind: 'running', phase: 'plan', lines: LINES } });
    expect(within(dialog()).getByText('Sync with the code')).toBeTruthy();
    expect(within(dialog()).getByText('Claude is reading your code…')).toBeTruthy();
    expect(within(dialog()).getByText('Started checking the board against the code')).toBeTruthy();
    expect(within(dialog()).getByText('specs/T-104-meal-planner.md')).toBeTruthy();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Stop' }));
    expect(p.onStop).toHaveBeenCalled();
  });

  it('applying shows its own progress line', () => {
    setup({ scope: 'T-104', view: { kind: 'running', phase: 'apply', lines: [] } });
    expect(within(dialog()).getByText('Sync T-104 with the code')).toBeTruthy();
    expect(within(dialog()).getByText('Claude is updating your specs…')).toBeTruthy();
  });
});

describe('SyncDialog: confirm', () => {
  it('warns with the change count and shows the proposal; Cancel discards, Confirm confirms', () => {
    const p = setup({ view: { kind: 'confirm', proposal: proposal() } });
    expect(within(dialog()).getByText('This will change 3 specs.')).toBeTruthy();
    expect(within(dialog()).getByText('Move T-106 to review')).toBeTruthy();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }));
    expect(p.onDiscard).toHaveBeenCalled();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Confirm' }));
    expect(p.onConfirm).toHaveBeenCalled();
  });

  it('one change reads in the singular', () => {
    setup({ view: { kind: 'confirm', proposal: proposal({ changes: 1 }) } });
    expect(within(dialog()).getByText('This will change 1 spec.')).toBeTruthy();
  });

  it('an unknown count says "your specs"', () => {
    setup({ view: { kind: 'confirm', proposal: proposal({ changes: null }) } });
    expect(within(dialog()).getByText('This will change your specs.')).toBeTruthy();
  });

  it('a scoped proposal names its spec in the title', () => {
    setup({ scope: 'T-104', view: { kind: 'confirm', proposal: proposal({ scope: 'T-104' }) } });
    expect(within(dialog()).getByText('Sync T-104 with the code')).toBeTruthy();
  });

  it('nothing to change: one Close button that discards the proposal', () => {
    const p = setup({ view: { kind: 'confirm', proposal: proposal({ changes: 0 }) } });
    expect(within(dialog()).getByText('Nothing to change. The board already matches the code.')).toBeTruthy();
    expect(within(dialog()).queryByRole('button', { name: 'Confirm' })).toBeNull();
    expect(within(dialog()).queryByRole('button', { name: 'Cancel' })).toBeNull();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Close' }));
    expect(p.onDiscard).toHaveBeenCalled();
  });

  it('a broken proposal says it can’t be read safely, disables Confirm and offers Discard', () => {
    const p = setup({ view: { kind: 'confirm', proposal: proposal({ changes: null, head: null, problems: ['bad front matter'] }) } });
    expect(within(dialog()).getByText('This proposal can’t be read safely.')).toBeTruthy();
    expect((within(dialog()).getByRole('button', { name: 'Confirm' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Discard' }));
    expect(p.onDiscard).toHaveBeenCalled();
    expect(p.onConfirm).not.toHaveBeenCalled();
  });
});
