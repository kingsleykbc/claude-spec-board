import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { recipeProject } from '../fixtures/recipeBox';
import { LogsModal } from './LogsModal';

const meta = {
  title: 'Modals/Logs',
  component: LogsModal,
  args: { project: recipeProject, onOpenSpec: fn(), onOpenOverview: fn(), onClose: fn(), now: new Date(2026, 10, 8, 12, 0) },
} satisfies Meta<typeof LogsModal>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Grouped: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    expect(await c.findAllByRole('heading', { level: 2 })).not.toHaveLength(0);
    expect(c.getByText(/draggable recipe sidebar/)).toBeTruthy();
  },
};

export const Search: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.type(await c.findByRole('searchbox', { name: 'Search logs' }), 'zzzzqq');
    expect(c.getByText('No logs match “zzzzqq”.')).toBeTruthy();
  },
};

export const Empty: Story = {
  args: { project: { ...recipeProject, specs: [], archived: [] } },
  play: async ({ canvasElement }) => {
    expect(await within(canvasElement).findByText('No logs yet.')).toBeTruthy();
  },
};
