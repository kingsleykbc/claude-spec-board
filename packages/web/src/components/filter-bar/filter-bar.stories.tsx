import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { FilterBar } from './filter-bar';
import { categoryOptions, NO_FILTERS, waitItems, type Filters, type MilestoneOption, type WaitItem } from '@/state/filters';
import type { View } from '@/state/viewMode';
import { recipeArchived, recipeSpecs } from '@/fixtures/recipeBox';
import { narrow, screenWidth } from '@/stories/narrow-screen';

const MILESTONES: MilestoneOption[] = [
  { value: 'Basics', label: 'Basics', done: 2, total: 3 },
  { value: 'Planner', label: 'Planner', done: 0, total: 2 },
];

function Bar({
  initial = NO_FILTERS,
  simple = false,
  milestones,
  waits = waitItems(recipeSpecs),
  onChange,
  onWait,
}: {
  initial?: Filters;
  simple?: boolean;
  waits?: WaitItem[];
  milestones?: MilestoneOption[];
  onChange: (f: Filters) => void;
  onWait: (w: WaitItem) => void;
}) {
  const [filters, setFilters] = useState(initial);
  const [view, setView] = useState<View>('board');
  const change = (f: Filters) => {
    setFilters(f);
    onChange(f);
  };
  return (
    <div style={{ minHeight: 280 }}>
      <FilterBar
        filters={filters}
        onChange={change}
        categories={categoryOptions(recipeSpecs, recipeArchived)}
        waits={waits}
        onWait={(w) => {
          onWait(w);
          if (w.kind === 'blocked') change({ ...filters, blocked: !filters.blocked });
        }}
        simple={simple}
        view={view}
        onView={setView}
        milestones={milestones}
      />
    </div>
  );
}

const meta = { title: 'Shell/FilterBar', component: Bar, args: { onChange: fn(), onWait: fn() } } satisfies Meta<typeof Bar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const NoFilters: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const body = within(document.body);
    expect(c.getByText('1 to review')).toBeTruthy();
    expect(c.getByText('3 questions for you')).toBeTruthy();
    expect(c.queryByText('Clear')).toBeNull();
    await userEvent.click(c.getByRole('button', { name: /^Category/ }));
    await userEvent.click(await body.findByRole('menuitemcheckbox', { name: /Backend/ }));
    expect(c.getByText('Clear')).toBeTruthy();
    await userEvent.keyboard('{Escape}');
  },
};

export const ActiveChips: Story = {
  args: { initial: { cats: ['Backend'], urg: ['urgent', 'normal'], blocked: true, milestone: null } },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    expect(c.getAllByRole('button', { name: 'Remove filter' })).toHaveLength(4);
    await userEvent.click(c.getByText('Clear'));
    expect(c.queryAllByRole('button', { name: 'Remove filter' })).toHaveLength(0);
  },
};

export const UrgencyMenu: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: /^Urgency/ }));
    const menu = await within(document.body).findByRole('menu', { name: 'Urgency' });
    expect(within(menu).getAllByRole('menuitemcheckbox')).toHaveLength(4);
  },
};

/** Simple mode: the waiting items sit behind ⋯ on the right. */
export const SimpleMode: Story = {
  args: { simple: true },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    expect(c.queryByText('1 to review')).toBeNull();
    await userEvent.click(c.getByRole('button', { name: 'Waiting on you' }));
    expect(await within(document.body).findByRole('menuitem', { name: '1 to review' })).toBeTruthy();
    // The Simple mode switch lives in the top bar now.
    expect(c.queryByRole('switch', { name: 'Simple mode' })).toBeNull();
    await userEvent.keyboard('{Escape}');
  },
};

/** Board | Table as icons with tooltips, and the milestone picker (Board view only). */
export const ViewAndMilestone: Story = {
  args: { milestones: MILESTONES, initial: { ...NO_FILTERS, milestone: 'Basics' } },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const body = within(document.body);
    expect(c.getByRole('button', { name: 'Milestone: Basics' }).textContent).toBe('Basics · 2/3');
    await userEvent.click(c.getByRole('button', { name: 'Milestone: Basics' }));
    await userEvent.click(await body.findByRole('menuitemradio', { name: 'All milestones' }));
    expect(c.getByRole('button', { name: 'Milestone: All milestones' })).toBeTruthy();
    await userEvent.hover(c.getByRole('radio', { name: 'Table view' }));
    expect(await body.findByRole('tooltip', { name: 'Table view' })).toBeTruthy();
    await userEvent.click(c.getByRole('radio', { name: 'Table view' }));
    expect(c.getByRole('radio', { name: 'Table view' }).getAttribute('aria-checked')).toBe('true');
    // The chosen view is raised: a different background from the other.
    const bg = (name: string) => getComputedStyle(c.getByRole('radio', { name })).backgroundColor;
    expect(bg('Table view')).not.toBe(bg('Board view'));
    expect(c.queryByRole('button', { name: /^Milestone:/ })).toBeNull();
  },
};

/** Narrow (720px): one "Filters" button with a badge opens a drawer holding Category, Urgency and Blocked only. */
export const Narrow: Story = {
  decorators: [narrow],
  args: { milestones: MILESTONES, initial: { ...NO_FILTERS, cats: ['Backend'], milestone: 'Basics' } },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const body = within(document.body);
    expect(c.queryByRole('button', { name: /^Category/ })).toBeNull();
    expect(c.getByRole('radio', { name: 'Board view' })).toBeTruthy();
    expect(c.getByRole('button', { name: 'Milestone: Basics' })).toBeTruthy();
    await userEvent.click(c.getByRole('button', { name: /^Filters/ }));
    const sheet = await body.findByRole('dialog', { name: 'Filters' });
    expect(within(sheet).getByRole('group', { name: 'Category' })).toBeTruthy();
    expect(sheet.getBoundingClientRect().left).toBeGreaterThanOrEqual(0);
    expect(sheet.getBoundingClientRect().right).toBeLessThanOrEqual(window.innerWidth);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(body.queryByRole('dialog')).toBeNull());
  },
};

/** 721px, just above the boundary: the controls stay inline and open as dropdowns. */
export const JustWide: Story = {
  decorators: [screenWidth(721)],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const body = within(document.body);
    expect(c.queryByRole('button', { name: /^Filters/ })).toBeNull();
    await userEvent.click(c.getByRole('button', { name: /^Category/ }));
    expect(await body.findByRole('menu', { name: 'Category' })).toBeTruthy();
    expect(body.queryByRole('dialog')).toBeNull();
    await userEvent.keyboard('{Escape}');
  },
};
