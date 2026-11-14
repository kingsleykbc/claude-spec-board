import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Spec } from '@specboard/core';
import { recipeArchived, recipeSpecs } from '../fixtures/recipeBox';
import { TableView } from './TableView';

const MS = ['Basics', 'Planner', 'Polish'];
const IN: Record<string, string> = { 'T-100': 'Basics', 'T-101': 'Basics', 'T-102': 'Basics', 'T-103': 'Basics', 'T-104': 'Planner', 'T-105': 'Planner' };
const withMs = (xs: Spec[]) => xs.map((x) => ({ ...x, milestone: IN[x.id] ?? null }));
const withTokens = (xs: Spec[]) =>
  xs.map((x) => (x.id === 'T-104' ? { ...x, logs: Object.fromEntries(Object.entries(x.logs).map(([k, l]) => [k, { ...l, tokens: 24100 }])) } : x));

const meta = {
  title: 'Shell/TableView',
  component: TableView,
  args: { specs: recipeSpecs, archived: recipeArchived, milestones: [], simple: false, trackTokens: false, onOpen: fn() },
} satisfies Meta<typeof TableView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Flat: Story = {
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    expect(c.getAllByRole('table')).toHaveLength(1);
    await userEvent.click(c.getByRole('button', { name: 'Subtasks of T-104' }));
    expect(c.getByRole('button', { name: 'Subtasks of T-104' }).getAttribute('aria-expanded')).toBe('true');
    await userEvent.click(c.getByRole('button', { name: recipeSpecs.find((x) => x.id === 'T-103')!.title }));
    expect(args.onOpen).toHaveBeenCalledWith('T-103');
  },
};

export const WithMilestones: Story = {
  args: { specs: withMs(recipeSpecs), archived: withMs(recipeArchived), milestones: MS },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    expect(c.getByRole('button', { name: 'Basics · 3/4' }).getAttribute('aria-expanded')).toBe('true');
    expect(c.getByText('No specs in this milestone yet.')).toBeTruthy();
    expect(c.getByRole('button', { name: /^Archived/ }).getAttribute('aria-expanded')).toBe('false');
  },
};

export const SimpleWithTokens: Story = {
  args: { simple: true, trackTokens: true, specs: withTokens(recipeSpecs) },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    expect(c.queryByRole('columnheader', { name: 'Urgency' })).toBeNull();
    // T-101 (from the sample's own log) and T-104 (added above) both come to 48.2k.
    expect(c.getAllByText('48.2k')).toHaveLength(2);
  },
};

export const Empty: Story = {
  args: { specs: [], archived: [] },
  play: async ({ canvasElement }) => {
    expect(within(canvasElement).getByText('No specs yet.')).toBeTruthy();
  },
};
