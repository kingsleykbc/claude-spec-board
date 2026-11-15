import type { Meta, StoryObj } from '@storybook/react-vite';
import { DndContext } from '@dnd-kit/core';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Column } from './column';
import { recipeSpecs } from '@/fixtures/recipeBox';

/** A plain stand-in card: the column only places what `renderCard` returns. */
const renderCard = (s: { id: string; title: string }) => (
  <div key={s.id} className="rounded-[10px] border border-line bg-card px-3 py-2.5 text-[13px]">
    {s.id} {s.title}
  </div>
);
const inStatus = (st: string) => recipeSpecs.filter((s) => s.status === st);

const meta = {
  title: 'Shell/Column',
  component: Column,
  decorators: [
    (Story) => (
      <DndContext>
        <div className="flex w-[320px] p-5">
          <Story />
        </div>
      </DndContext>
    ),
  ],
  args: { status: 'todo', specs: inStatus('todo'), placeholderAt: null, over: false, renderCard },
} satisfies Meta<typeof Column>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ToDo: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    expect(c.getByRole('region', { name: 'To-do' })).toBeTruthy();
    expect(c.getByText('4')).toBeTruthy();
  },
};

/** Review says "Needs you" while it has cards, on its own tint. */
export const Review: Story = {
  args: { status: 'review', specs: inStatus('review') },
  play: async ({ canvasElement }) => {
    expect(within(canvasElement).getByText('Needs you')).toBeTruthy();
  },
};

export const Empty: Story = {
  args: { status: 'doing', specs: [] },
  play: async ({ canvasElement }) => {
    expect(within(canvasElement).getByText('Nothing in progress')).toBeTruthy();
  },
};

/** A card from another column is over this one: dashed accent outline and the placeholder in sort order. */
export const DropTarget: Story = {
  args: { status: 'review', specs: inStatus('review'), over: true, placeholderAt: 0 },
  play: async ({ canvasElement }) => {
    expect(within(canvasElement).getByText('Drop to move to Review')).toBeTruthy();
  },
};

/** Done with archived specs under the current filters: the toggle names how many. */
export const DoneWithArchived: Story = {
  args: { status: 'done', specs: inStatus('done'), archivedCount: 1, showArchived: false, onToggleArchived: fn() },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Show archived (1)' }));
    expect(args.onToggleArchived).toHaveBeenCalled();
  },
};

/** No archived spec matches the filters: no toggle. */
export const DoneNoArchived: Story = {
  args: { status: 'done', specs: inStatus('done'), archivedCount: 0 },
  play: async ({ canvasElement }) => {
    expect(within(canvasElement).queryByRole('button', { name: /archived/ })).toBeNull();
  },
};
