import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { recipeProject } from '@/fixtures/recipeBox';
import { OverviewModal } from './overview-modal';

const meta = {
  title: 'Modals/Overview',
  component: OverviewModal,
  args: {
    project: recipeProject,
    name: 'Recipe Box',
    toast: fn(),
    onRefresh: fn(),
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

/** Claude isn't connected: Refresh is greyed and shows the command to paste. */
export const NotConnected: Story = {
  args: { manual: 'not-installed' },
  play: async ({ canvasElement, userEvent }) => {
    const dlg = within(canvasElement).getByRole('dialog', { name: 'Overview' });
    await userEvent.click(within(dlg).getByRole('button', { name: 'Refresh' }));
    expect(await within(document.body).findByText('/specboard:refresh-overview')).toBeTruthy();
  },
};

export const Refreshing: Story = {
  args: { refreshing: true },
  play: async ({ canvasElement }) => {
    const dlg = within(canvasElement).getByRole('dialog', { name: 'Overview' });
    expect(within(dlg).getByRole('button', { name: 'Refreshing' })).toHaveProperty('disabled', true);
    expect(within(dlg).getByText('Updating…')).toBeTruthy();
    expect(within(dlg).getByText('Claude is rewriting the summary…')).toBeTruthy();
  },
};

export const TasksExpanded: Story = {
  play: async ({ canvasElement, userEvent }) => {
    const dlg = within(canvasElement).getByRole('dialog', { name: 'Overview' });
    expect(within(dlg).getByText('SUMMARY')).toBeTruthy();
    await userEvent.click(within(dlg).getByRole('button', { name: 'Tasks' }));
    expect(within(dlg).getAllByRole('table')[0]).toBeTruthy();
  },
};
