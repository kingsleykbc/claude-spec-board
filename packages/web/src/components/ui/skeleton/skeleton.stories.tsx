import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { AppSkeleton, BoardSkeleton, DocSkeleton } from './skeleton';

const meta = { title: 'UI/Skeleton', component: AppSkeleton } satisfies Meta<typeof AppSkeleton>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Before the project list arrives. */
export const App: Story = {
  play: async ({ canvasElement }) => {
    expect(within(canvasElement).getByRole('status').textContent).toBe('Loading the board…');
  },
};

/** A project switch: the top bar is real, the board is loading. */
export const Board: StoryObj = { render: () => <BoardSkeleton /> };

/** The references modal before its list arrives. */
export const Document: StoryObj = {
  render: () => (
    <div className="w-[520px] p-6">
      <DocSkeleton label="Loading reference documents…" />
    </div>
  ),
};
