import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
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

/** Claude isn’t connected: Refresh is greyed and shows the command to paste. */
export const NotConnected: Story = {
  args: { manual: 'not-installed' },
  play: async ({ canvasElement, userEvent }) => {
    const dlg = within(canvasElement).getByRole('dialog', { name: 'Overview' });
    await userEvent.click(within(dlg).getByRole('button', { name: 'Refresh' }));
    expect(await within(document.body).findByText('/refresh-overview')).toBeTruthy();
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

/** The config body has Stack and Design sections: only the description before the first ## heading shows. */
export const DescriptionOnly: Story = {
  args: {
    project: { ...recipeProject, config: { ...recipeProject.config!, description: 'A **web app** to save recipes.\n\n## Stack\nReact and Postgres\n\n## Design\nWarm and simple' } },
  },
  play: async ({ canvasElement }) => {
    const dlg = within(canvasElement).getByRole('dialog', { name: 'Overview' });
    expect(within(dlg).getByText('web app').tagName).toBe('STRONG');
    expect(within(dlg).queryByText(/React and Postgres/)).toBeNull();
    expect(within(dlg).queryByText(/Warm and simple/)).toBeNull();
  },
};

/** Claude's status isn't known yet: Refresh summary is neutral (no accent fill) and a click waits. */
export const StatusUnknown: Story = {
  args: { statusKnown: false, project: { ...recipeProject, overview: null } },
  play: async ({ canvasElement, args }) => {
    const dlg = within(canvasElement).getByRole('dialog', { name: 'Overview' });
    const btn = within(dlg).getByRole('button', { name: 'Refresh summary' });
    expect(btn.className).not.toMatch(/bg-accent/);
    await userEvent.click(btn);
    expect(args.onRefresh).not.toHaveBeenCalled();
  },
};

/** Refresh just clicked: a spinner and Starting…, disabled, until the refresh run has started (then Refreshing). */
export const RefreshStarting: Story = {
  args: { onRefresh: fn(() => new Promise<boolean>(() => undefined)) },
  play: async ({ canvasElement, args }) => {
    const dlg = within(canvasElement).getByRole('dialog', { name: 'Overview' });
    await userEvent.click(within(dlg).getByRole('button', { name: 'Refresh' }));
    const btn = await within(dlg).findByRole('button', { name: 'Starting…' });
    expect(btn).toHaveProperty('disabled', true);
    await userEvent.click(btn);
    expect(args.onRefresh).toHaveBeenCalledOnce();
  },
};

const outOfSync = { ...recipeProject, overview: { ...recipeProject.overview!, outOfSync: 'Two cards look further along in the code than on the board.' } };

/** refresh-overview found the board and the code out of sync: a warning box under the summary with the header menu’s Sync. */
export const OutOfSync: Story = {
  args: { project: outOfSync, onSync: fn() },
  play: async ({ canvasElement, args }) => {
    const dlg = within(canvasElement).getByRole('dialog', { name: 'Overview' });
    const box = within(dlg).getByRole('note', { name: 'Out of sync' });
    expect(box.textContent).toContain('Two cards look further along in the code than on the board.');
    await userEvent.click(within(box).getByRole('button', { name: 'Sync' }));
    expect(args.onSync).toHaveBeenCalledOnce();
  },
};

/** The box’s Sync just clicked: Starting…, disabled, like every button that starts Claude. */
export const OutOfSyncStarting: Story = {
  args: { project: outOfSync, onSync: fn(() => new Promise<void>(() => undefined)) },
  play: async ({ canvasElement, args }) => {
    const box = within(canvasElement).getByRole('note', { name: 'Out of sync' });
    await userEvent.click(within(box).getByRole('button', { name: 'Sync' }));
    expect(await within(box).findByRole('button', { name: 'Starting…' })).toHaveProperty('disabled', true);
    expect(args.onSync).toHaveBeenCalledOnce();
  },
};
