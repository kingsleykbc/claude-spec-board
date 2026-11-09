import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { recipeProject } from '../fixtures/recipeBox';
import { OverviewModal } from './OverviewModal';

const meta = {
  title: 'Modals/Overview',
  component: OverviewModal,
  args: {
    pid: 'p1',
    project: recipeProject,
    name: 'Recipe Box',
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

// TODO(Task 8): restore the `Refreshing` story (a refresh run in flight) once Refresh starts a real run.
