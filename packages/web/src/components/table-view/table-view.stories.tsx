import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Spec } from '@specboard/core';
import { recipeArchived, recipeSpecs } from '@/fixtures/recipeBox';
import { TableView } from './table-view';

const MS = ['Basics', 'Planner', 'Polish'];
const IN: Record<string, string> = { 'T-100': 'Basics', 'T-101': 'Basics', 'T-102': 'Basics', 'T-103': 'Basics', 'T-104': 'Planner', 'T-105': 'Planner' };
const withMs = (xs: Spec[]) => xs.map((x) => ({ ...x, milestone: IN[x.id] ?? null }));
const withTokens = (xs: Spec[]) =>
  xs.map((x) => (x.id === 'T-104' ? { ...x, logs: Object.fromEntries(Object.entries(x.logs).map(([k, l]) => [k, { ...l, tokens: 24100 }])) } : x));

/** The `col` widths of each table's colgroup, in order ('auto' for the Title column). */
const colWidths = (root: HTMLElement) =>
  [...root.querySelectorAll('table')].map((t) => [...t.querySelectorAll('colgroup > col')].map((c) => (c as HTMLElement).style.width || 'auto'));

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

/** Milestone groups, No milestone and Archived, with tracking on: every group shares one column template. */
export const Milestones: Story = {
  args: { specs: withMs(recipeSpecs), archived: withMs(recipeArchived), milestones: MS, trackTokens: true },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    expect(c.getByRole('button', { name: 'Basics · 3/4' }).getAttribute('aria-expanded')).toBe('true');
    expect(c.getByText('No specs in this milestone yet.')).toBeTruthy();
    const archived = c.getByRole('button', { name: /^Archived/ });
    expect(archived.getAttribute('aria-expanded')).toBe('false');
    await userEvent.click(archived);
    const widths = colWidths(canvasElement);
    expect(widths).toHaveLength(5);
    for (const w of widths) expect(w).toEqual(['40px', '96px', 'auto', '140px', '96px', '112px', '220px', '96px']);
    await userEvent.click(archived);
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

/** Tracking off: no Tokens column at all, in any group. */
export const TrackingOff: Story = {
  args: { specs: withMs(recipeSpecs), archived: withMs(recipeArchived), milestones: MS, trackTokens: false },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    expect(c.queryByRole('columnheader', { name: 'Tokens' })).toBeNull();
    for (const w of colWidths(canvasElement)) expect(w).toEqual(['40px', '96px', 'auto', '140px', '96px', '112px', '220px']);
  },
};

/** The read-only overview table: its own column set, shared across its groups. */
export const Compact: Story = {
  args: { compact: true, onOpen: undefined, specs: withMs(recipeSpecs), archived: [], milestones: MS },
  play: async ({ canvasElement }) => {
    const widths = colWidths(canvasElement);
    expect(widths).toHaveLength(4);
    for (const w of widths) expect(w).toEqual(['96px', 'auto', '140px', '96px']);
  },
};

const LONG = 'Meal planner calendar with drag and drop between days, weekly totals and a printable shopping summary';

/** A long title stays on one line with an ellipsis; its Hint shows the full title. */
export const LongTitle: Story = {
  args: { specs: recipeSpecs.map((x) => (x.id === 'T-104' ? { ...x, title: LONG } : x)) },
  play: async ({ canvasElement }) => {
    const btn = within(canvasElement).getByRole('button', { name: LONG });
    expect(btn.className).toContain('truncate');
  },
};

export const Empty: Story = {
  args: { specs: [], archived: [] },
  play: async ({ canvasElement }) => {
    expect(within(canvasElement).getByText('No specs yet.')).toBeTruthy();
  },
};
