import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { BlockedBanner } from './blocked-banner';

const meta = {
  title: 'Detail/BlockedBanner',
  component: BlockedBanner,
  args: {
    reasons: [
      { key: 'q', text: 'Awaiting answers on: Should the export include quantities?, Preferred export format?', onClick: fn() },
      { key: 'd', text: 'Waiting on T-104 Meal planner calendar (Doing)', onClick: fn() },
    ],
  },
  decorators: [
    (Story) => (
      <div className="max-w-[900px] bg-card">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BlockedBanner>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    expect(within(canvasElement).getAllByRole('button')).toHaveLength(2);
  },
};
