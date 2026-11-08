import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { recipeSpec } from '../../fixtures/recipeBox';
import { createMutator } from '../../state/mutate';
import { Subtasks } from './Subtasks';

// Subtasks with the inline log (pinned behaviour 10).

const meta = {
  title: 'Detail/Subtasks',
  component: Subtasks,
  decorators: [
    (Story) => (
      <div style={{ padding: 24, maxWidth: 860, background: 'var(--card)' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    pid: 'p1',
    spec: recipeSpec('T-104'),
    client: { setSubtask: fn(async (_pid: string, id: string) => ({ hash: 'h2', spec: recipeSpec(id) })) },
    mutate: createMutator(() => Promise.reject(new Error('no default op'))),
    refresh: fn(async () => undefined),
    toast: fn(),
  },
} satisfies Meta<typeof Subtasks>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    expect(c.getByText('2 of 5 done')).toBeTruthy();
    expect(c.queryByText('In progress')).toBeNull();
  },
};

export const OpenLog: Story = {
  name: 'With an open log',
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getAllByRole('button', { name: /Log/ })[0]!);
    const log = c.getByTestId('subtask-log');
    expect(within(log).getByText('Nov 7, 15:12')).toBeTruthy();
    expect(within(log).getByText('src/pages/Planner.tsx')).toBeTruthy();
    expect(within(log).getByText('4f2a91c')).toBeTruthy();
  },
};

export const InProgress: Story = {
  name: 'In progress',
  args: { runActive: true },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const pill = c.getByText('In progress');
    expect(pill.closest('[data-subtask]')!.getAttribute('data-subtask')).toBe('3');
  },
};

export const LiveChange: Story = {
  name: 'Live change',
  args: { changed: new Set(['T-104', 'T-104:2']) },
  play: async ({ canvasElement }) => {
    const row = canvasElement.querySelector<HTMLElement>('[data-subtask="2"]')!;
    expect(row.style.background).toBe('var(--accent-soft)');
  },
};

export const AllDone: Story = {
  name: 'All done',
  args: { spec: recipeSpec('T-101') },
  play: async ({ canvasElement }) => {
    expect(within(canvasElement).getByTestId('subtask-bar').style.background).toBe('var(--done)');
  },
};

export const Empty: Story = {
  args: { spec: { ...recipeSpec('T-104'), subtasks: [], logs: {} } },
  play: async ({ canvasElement }) => {
    expect(within(canvasElement).getByText('No subtasks yet. Claude adds them when it writes up the spec.')).toBeTruthy();
  },
};
