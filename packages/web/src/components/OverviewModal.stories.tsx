import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { recipeProject } from '../fixtures/recipeBox';
import { OverviewModal } from './OverviewModal';

const meta = {
  title: 'Modals/Overview',
  component: OverviewModal,
  args: {
    pid: 'p1',
    project: recipeProject,
    name: 'Recipe Box',
    client: { claude: fn(async () => ({ stub: true })) },
    toast: fn(),
    onClose: fn(),
    now: new Date(2026, 10, 8, 11, 30),
  },
} satisfies Meta<typeof OverviewModal>;
export default meta;
type Story = StoryObj<typeof meta>;

export const WithSummary: Story = {
  play: async ({ canvasElement }) => {
    const dlg = within(canvasElement).getByRole('dialog', { name: 'Overview' });
    expect(within(dlg).getByText('3/9')).toBeTruthy();
    expect(within(dlg).getByText('Last updated 2h ago')).toBeTruthy();
    expect(within(dlg).getByText('Search & filters')).toBeTruthy();
  },
};

export const Empty: Story = {
  args: {
    name: 'Empty project',
    project: { ...recipeProject, config: { ...recipeProject.config!, name: 'Empty project', description: 'Nothing here yet.' }, overview: null, specs: [], archived: [] },
  },
  play: async ({ canvasElement }) => {
    const dlg = within(canvasElement).getByRole('dialog', { name: 'Overview' });
    expect(within(dlg).getByText('0/0')).toBeTruthy();
    expect(within(dlg).getByText('No summary yet. Ask Claude to refresh the overview.')).toBeTruthy();
  },
};

export const Refreshing: Story = {
  args: { client: { claude: fn(() => new Promise<{ stub: boolean }>(() => undefined)) } },
  play: async ({ canvasElement }) => {
    const dlg = within(canvasElement).getByRole('dialog', { name: 'Overview' });
    await userEvent.click(within(dlg).getByRole('button', { name: '↻ Refresh' }));
    expect(within(dlg).getByRole('button', { name: 'Refreshing' })).toHaveProperty('disabled', true);
    expect(within(dlg).getByText('Claude is rewriting the summary…')).toBeTruthy();
    expect(within(dlg).getByText('Updating…')).toBeTruthy();
  },
};
