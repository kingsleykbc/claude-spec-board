import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { FiltersDrawer } from './filters-drawer';
import { categoryOptions, NO_FILTERS, type Filters } from '@/state/filters';
import { recipeArchived, recipeSpecs } from '@/fixtures/recipeBox';

function Example({ initial = NO_FILTERS, onChange }: { initial?: Filters; onChange: (f: Filters) => void }) {
  const [filters, setFilters] = useState(initial);
  return (
    <div className="p-3">
      <FiltersDrawer
        filters={filters}
        categories={categoryOptions(recipeSpecs, recipeArchived)}
        onChange={(f) => {
          setFilters(f);
          onChange(f);
        }}
      />
    </div>
  );
}

const meta = {
  title: 'Shell/FilterBar/FiltersDrawer',
  component: Example,
  args: { onChange: fn() },
} satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;

/** No filters: the button has no badge. */
export const NoFilters: Story = {
  play: async ({ canvasElement }) => {
    expect(within(canvasElement).getByRole('button', { name: 'Filters' }).querySelector('[data-testid="filter-count"]')).toBeNull();
  },
};

/** One category, two urgencies and Blocked only: badge 4. */
export const Active: Story = {
  args: { initial: { cats: ['Backend'], urg: ['urgent', 'normal'], blocked: true, milestone: 'Basics' } },
};

/** Open: Category, Urgency and Blocked only in a bottom sheet that fits the screen, plus Clear filters. */
export const Open: Story = {
  args: { initial: { ...NO_FILTERS, cats: ['Backend'] } },
  play: async ({ canvasElement, args }) => {
    const body = within(document.body);
    await userEvent.click(within(canvasElement).getByRole('button', { name: /^Filters/ }));
    const sheet = await body.findByRole('dialog', { name: 'Filters' });
    expect(sheet.getBoundingClientRect().right).toBeLessThanOrEqual(window.innerWidth);
    // It slides up from below; once in, it sits on the bottom edge.
    await waitFor(() => expect(Math.abs(sheet.getBoundingClientRect().bottom - window.innerHeight)).toBeLessThanOrEqual(1));
    await userEvent.click(within(sheet).getByRole('checkbox', { name: /Frontend/ }));
    expect(args.onChange).toHaveBeenLastCalledWith({ ...NO_FILTERS, cats: ['Backend', 'Frontend'] });
    await userEvent.click(within(sheet).getByRole('switch', { name: 'Blocked only' }));
    expect(within(sheet).getByRole('switch', { name: 'Blocked only' }).getAttribute('aria-checked')).toBe('true');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Clear filters' }));
    expect(args.onChange).toHaveBeenLastCalledWith(NO_FILTERS);
  },
};
