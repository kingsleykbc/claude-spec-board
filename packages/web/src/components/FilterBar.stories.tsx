import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { FilterBar, type FilterMenu } from './FilterBar';
import { categoryOptions, NO_FILTERS, waitItems, type Filters, type MilestoneOption } from '../state/filters';
import type { View } from '../state/viewMode';
import { recipeArchived, recipeSpecs } from '../fixtures/recipeBox';

const MILESTONES: MilestoneOption[] = [
  { value: 'Basics', label: 'Basics', done: 3, total: 4 },
  { value: 'Planner', label: 'Planner', done: 0, total: 2 },
];

function Bar({
  initial = NO_FILTERS,
  menu: initialMenu = null,
  simple: initialSimple = false,
  milestones,
}: {
  initial?: Filters;
  menu?: FilterMenu;
  simple?: boolean;
  milestones?: MilestoneOption[];
}) {
  const [filters, setFilters] = useState(initial);
  const [view, setView] = useState<View>('board');
  const [simple, setSimple] = useState(initialSimple);
  const [menu, setMenu] = useState<FilterMenu>(initialMenu);
  return (
    <div style={{ minHeight: 280 }}>
      <FilterBar
        filters={filters}
        onChange={setFilters}
        categories={categoryOptions(recipeSpecs, recipeArchived)}
        waits={waitItems(recipeSpecs)}
        onWait={(w) => {
          if (w.kind === 'blocked') setFilters((f) => ({ ...f, blocked: !f.blocked }));
        }}
        menu={menu}
        onMenu={setMenu}
        simple={simple}
        onSimple={setSimple}
        view={view}
        onView={setView}
        milestones={milestones}
      />
    </div>
  );
}

const meta = { title: 'Shell/FilterBar', component: Bar } satisfies Meta<typeof Bar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const NoFilters: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    expect(c.getByText('1 to review')).toBeTruthy();
    expect(c.getByText('3 questions for you')).toBeTruthy();
    expect(c.queryByText('Clear')).toBeNull();
    await userEvent.click(c.getByRole('button', { name: /^Category/ }));
    await userEvent.click(c.getByRole('checkbox', { name: /Backend/ }));
    expect(c.getByText('Clear')).toBeTruthy();
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
  args: { menu: 'urg' },
  play: async ({ canvasElement }) => {
    expect(within(canvasElement).getAllByRole('checkbox')).toHaveLength(4);
  },
};

/** Simple mode: the waiting items sit behind ⋯ on the right. */
export const SimpleMode: Story = {
  args: { simple: true },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    expect(c.queryByText('1 to review')).toBeNull();
    await userEvent.click(c.getByRole('button', { name: 'Waiting on you' }));
    expect(c.getByRole('menuitem', { name: '1 to review' })).toBeTruthy();
    await userEvent.click(c.getByRole('switch', { name: 'Simple mode' }));
    expect(c.getByText('1 to review')).toBeTruthy();
  },
};

/** Board | Table switch and the milestone dropdown (Board view only). */
export const ViewAndMilestone: Story = {
  args: { milestones: MILESTONES, initial: { ...NO_FILTERS, milestone: 'Basics' } },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole('button', { name: 'Milestone: Basics' }));
    await userEvent.click(c.getByRole('menuitemradio', { name: 'All milestones' }));
    expect(c.getByRole('button', { name: 'Milestone: All milestones' })).toBeTruthy();
    await userEvent.click(c.getByRole('radio', { name: 'Table' }));
    expect(c.getByRole('radio', { name: 'Table' }).getAttribute('aria-checked')).toBe('true');
    expect(c.queryByRole('button', { name: /^Milestone:/ })).toBeNull();
  },
};
