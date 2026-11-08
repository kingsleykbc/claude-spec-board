import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { PERMISSION_RULE, RUN_LINES, RunPanel, type RunLine } from './RunPanel';

// The RUN OUTPUT aside in its six states. Shown in stories only in M2 (M3 feeds it real lines).

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

const withLine = (l: RunLine) => [...RUN_LINES, l];
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
  args: { status: 'finished', lines: withLine({ k: 'done', text: 'All subtasks done · committed', code: 'c81e0f2', time: '17:02' }) },
  play: async ({ canvasElement }) => {
    expect(endTitle(canvasElement)).toBe('Done. Moved to Review.');
  },
};

export const Stopped: Story = {
  args: { status: 'stopped', lines: withLine({ k: 'stop', text: 'Stopped by you', time: '16:45' }) },
  play: async ({ canvasElement }) => {
    expect(within(canvasElement).getByTestId('run-chip').textContent).toBe('Stopped');
  },
};

export const Needs: Story = {
  name: 'Needs your answer',
  args: { status: 'needs', lines: withLine({ k: 'warn', text: 'Paused: Claude added an open question', time: '16:45' }) },
  play: async ({ canvasElement }) => {
    expect(within(canvasElement).getByRole('button', { name: 'Go to question' })).toBeTruthy();
  },
};

export const Permission: Story = {
  name: 'Permission needed',
  args: { status: 'permission', lines: withLine({ k: 'err', text: 'Not allowed:', code: 'npm install date-fns', time: '16:45' }) },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    expect(c.getByText('Stopped: permission needed')).toBeTruthy();
    expect(c.getByText(PERMISSION_RULE).tagName).toBe('CODE');
    expect(c.getByText('Add this to .claude/settings.json, or install date-fns yourself, then run again.')).toBeTruthy();
    expect(c.getByRole('button', { name: 'Copy rule' })).toBeTruthy();
  },
};

export const ErrorState: Story = {
  name: 'Error',
  args: { status: 'error', lines: withLine({ k: 'err', text: 'Claude Code exited with code 1', time: '16:45' }) },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    expect(c.getByText('Claude Code exited unexpectedly (code 1). The terminal has the full output. Work up to the last commit is safe.')).toBeTruthy();
    expect(c.getByRole('button', { name: 'Run again' })).toBeTruthy();
  },
};
