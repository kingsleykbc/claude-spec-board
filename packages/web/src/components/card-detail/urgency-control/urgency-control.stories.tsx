import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { UrgencyControl } from './urgency-control';

const meta = {
  title: 'Detail/UrgencyControl',
  component: UrgencyControl,
  args: { value: 'urgent', onPick: fn() },
  decorators: [
    (Story) => (
      <div className="bg-card p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof UrgencyControl>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    expect(within(canvasElement).getByRole('radio', { name: /Urgent/ }).getAttribute('aria-checked')).toBe('true');
  },
};
