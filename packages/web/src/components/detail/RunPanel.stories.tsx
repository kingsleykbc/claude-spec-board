import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import type { RunLine } from '../../api/client';
import { FIX_NOTE, RUN_LINES, RunPanel } from './RunPanel';

// The RUN OUTPUT aside in its states, with the end info the server sends.

const FIX = 'specboard allow "Bash(npm install:*)"';

const meta = {
  title: 'Detail/RunPanel',
  component: RunPanel,
  decorators: [
    (Story) => (
      <div style={{ display: 'grid', width: 380, height: 560, background: 'var(--card)' }}>
        <Story />
      </div>
    ),
  ],
  args: { status: 'running', lines: RUN_LINES, onDismiss: fn(), onAction: fn() },
} satisfies Meta<typeof RunPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

const withLine = (l: Omit<RunLine, 'seq'>) => [...RUN_LINES, { seq: RUN_LINES.length + 1, ...l }];
const endTitle = (el: HTMLElement) => within(within(el).getByTestId('run-end')).getAllByText(/./)[0]!.textContent;

export const Running: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    expect(c.getByTestId('run-chip').textContent).toBe('Running');
    expect(c.getByText('Working…')).toBeTruthy();
    expect(c.queryByRole('button', { name: 'Dismiss' })).toBeNull();
  },
};

export const Finished: Story = {
  args: { status: 'finished', end: { status: 'finished' }, lines: withLine({ k: 'done', text: 'All subtasks done · committed', code: 'c81e0f2', time: '17:02' }) },
  play: async ({ canvasElement }) => {
    expect(endTitle(canvasElement)).toBe('Done. Moved to Review.');
  },
};

export const FinishedWithRefusals: Story = {
  args: {
    status: 'finished',
    end: { status: 'finished', text: 'Claude was refused 1 action on the way. Check the result before moving this to Done.', denied: [{ tool: 'Bash', input: { command: 'npm install date-fns' } }] },
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText('Done. Moved to Review.')).toBeTruthy();
    await expect(c.getByText(/refused 1 action/)).toBeTruthy();
    await expect(c.queryByRole('button', { name: 'Copy rule' })).toBeNull();
  },
};

export const Stopped: Story = {
  args: { status: 'stopped', end: { status: 'stopped' }, lines: withLine({ k: 'stop', text: 'Stopped by you', time: '16:45' }) },
  play: async ({ canvasElement }) => {
    expect(within(canvasElement).getByTestId('run-chip').textContent).toBe('Stopped');
  },
};

export const Needs: Story = {
  name: 'Needs your answer',
  args: { status: 'needs', end: { status: 'needs', title: 'Claude has a question', text: 'There is 1 unanswered question on this spec.' }, lines: withLine({ k: 'warn', text: 'Paused: Claude added an open question', time: '16:45' }) },
  play: async ({ canvasElement }) => {
    expect(within(canvasElement).getByRole('button', { name: 'Go to question' })).toBeTruthy();
  },
};

export const Permission: Story = {
  name: 'Permission needed',
  args: {
    status: 'permission',
    end: { status: 'permission', title: 'Claude needs permission', text: 'Claude was stopped from using Bash `npm install date-fns`. Allow it for this project, then run again.', fix: FIX },
    lines: withLine({ k: 'err', text: 'Not allowed:', code: 'npm install date-fns', time: '16:45' }),
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    expect(c.getByText('Claude needs permission')).toBeTruthy();
    expect(c.getByText(FIX).tagName).toBe('CODE');
    expect(c.getByText(FIX_NOTE)).toBeTruthy();
    expect(c.getByRole('button', { name: 'Copy rule' })).toBeTruthy();
  },
};

export const PermissionBlocked: Story = {
  name: 'Permission blocked by policy',
  args: {
    status: 'permission',
    end: { status: 'permission', title: 'Claude needs permission', text: 'Claude was stopped from using Bash `git push`. This action is blocked by this project\'s rules.' },
    lines: withLine({ k: 'err', text: 'Not allowed:', code: 'git push', time: '16:45' }),
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    expect(c.getByText(/blocked by this project/)).toBeTruthy();
    expect(c.queryByRole('button', { name: 'Copy rule' })).toBeNull();
  },
};

export const ErrorState: Story = {
  name: 'Error',
  args: { status: 'error', end: { status: 'error', title: 'Claude Code exited with code 1' }, lines: withLine({ k: 'err', text: 'Claude Code exited with code 1', time: '16:45' }) },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    expect(c.getByText('Claude Code exited unexpectedly. Work up to the last commit is safe.')).toBeTruthy();
    expect(c.getByRole('button', { name: 'Run again' })).toBeTruthy();
  },
};
