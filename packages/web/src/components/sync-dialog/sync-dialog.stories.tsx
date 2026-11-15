import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { SyncDialog, type WaitingProposal } from './sync-dialog';

const proposal: WaitingProposal = {
  exists: true,
  head: 'a1b2c3d',
  changes: 3,
  created: '2026-11-14',
  scope: null,
  bodyMd: [
    '- T-104 has two subtasks done in git that the card doesn’t show.',
    '- T-106 looks finished.',
    '',
    '1. Tick T-104 subtask 2 (commit a1b2c3d)',
    '2. Move T-106 to review',
    '3. Archive T-090',
  ].join('\n'),
  problems: [],
};

const meta = {
  title: 'Modals/Sync',
  component: SyncDialog,
  args: {
    scope: null,
    view: { kind: 'manual' },
    toast: fn(),
    onStop: fn(),
    onDiscard: fn(),
    onConfirm: fn(),
    onClose: fn(),
  },
} satisfies Meta<typeof SyncDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

const dlg = (el: HTMLElement) => within(within(el).getByRole('dialog'));

export const Manual: Story = {
  play: async ({ canvasElement }) => {
    expect(dlg(canvasElement).getByText('/specboard:sync-specs')).toBeTruthy();
  },
};

export const ManualForACard: Story = {
  args: { scope: 'T-104' },
  play: async ({ canvasElement }) => {
    expect(dlg(canvasElement).getByText('/specboard:sync-specs T-104')).toBeTruthy();
  },
};

export const Reading: Story = {
  args: {
    view: {
      kind: 'running',
      phase: 'plan',
      lines: [
        { seq: 1, k: 'start', text: 'Started checking the board against the code', time: '10:00' },
        { seq: 2, k: 'cmd', text: 'Ran', code: 'git log --oneline -20', time: '10:00' },
        { seq: 3, k: 'read', text: 'Read', code: 'specs/T-104-meal-planner-calendar.md', time: '10:01' },
      ],
    },
  },
  play: async ({ canvasElement }) => {
    expect(dlg(canvasElement).getByText('Claude is reading your code…')).toBeTruthy();
  },
};

export const Confirm: Story = {
  args: { view: { kind: 'confirm', proposal } },
  play: async ({ canvasElement }) => {
    expect(dlg(canvasElement).getByText('This will change 3 specs.')).toBeTruthy();
  },
};

export const ConfirmForACard: Story = {
  args: { scope: 'T-104', view: { kind: 'confirm', proposal: { ...proposal, scope: 'T-104', changes: 1 } } },
  play: async ({ canvasElement }) => {
    expect(dlg(canvasElement).getByText('Sync T-104 with the code')).toBeTruthy();
  },
};

export const NothingToChange: Story = {
  args: { view: { kind: 'confirm', proposal: { ...proposal, changes: 0, bodyMd: '' } } },
  play: async ({ canvasElement }) => {
    expect(dlg(canvasElement).getByText('Nothing to change. The board already matches the code.')).toBeTruthy();
  },
};

export const Broken: Story = {
  args: { view: { kind: 'confirm', proposal: { ...proposal, head: null, changes: null, problems: ['Front matter is not valid YAML'] } } },
  play: async ({ canvasElement }) => {
    expect((dlg(canvasElement).getByRole('button', { name: 'Confirm' }) as HTMLButtonElement).disabled).toBe(true);
  },
};
