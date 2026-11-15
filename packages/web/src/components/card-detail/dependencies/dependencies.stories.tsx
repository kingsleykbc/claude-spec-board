import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { recipeArchived, recipeSpec, recipeSpecs } from '@/fixtures/recipeBox';
import { Dependencies } from './dependencies';

const all = [...recipeSpecs, ...recipeArchived];

const meta = {
  title: 'Detail/Dependencies',
  component: Dependencies,
  decorators: [
    (Story) => (
      <div className="max-w-[860px] bg-card p-6">
        <Story />
      </div>
    ),
  ],
  args: { spec: recipeSpec('T-104'), all, onOpen: fn() },
} satisfies Meta<typeof Dependencies>;
export default meta;
type Story = StoryObj<typeof meta>;

export const BothLists: Story = {
  name: 'Both lists',
  // T-104 made to depend on T-101 (done), T-106 (not done) and a missing T-404; T-105 waits on it.
  args: { spec: { ...recipeSpec('T-104'), dependsOn: ['T-101', 'T-106', 'T-404'] } },
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    expect(c.getAllByText('Not done')).toHaveLength(1);
    expect(c.getByText('Not found')).toBeTruthy();
    await userEvent.click(c.getByRole('button', { name: /T-105/ }));
    expect(args.onOpen).toHaveBeenCalledWith('T-105');
  },
};

export const Empty: Story = {
  args: { spec: recipeSpec('T-107') },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    expect(c.getByText('Nothing. This spec can start any time.')).toBeTruthy();
    expect(c.getByText('No other spec waits on this one.')).toBeTruthy();
  },
};
