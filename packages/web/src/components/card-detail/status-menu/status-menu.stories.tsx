import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { narrow } from '@/stories/narrow-screen';
import { StatusMenu } from './status-menu';

const meta = {
  title: 'Detail/StatusMenu',
  component: StatusMenu,
  args: { status: 'review', onPick: fn() },
  decorators: [
    (Story) => (
      <div className="flex h-[220px] justify-end p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StatusMenu>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Open: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Review' }));
    const menu = await body.findByRole('menu', { name: 'Status' });
    expect(within(menu).getByRole('menuitemradio', { name: /Done/ }).textContent).toContain('Approve');
    expect(within(menu).getByRole('menuitemradio', { name: /Review/ }).textContent).toContain('Current');
  },
};

/** 720px and under: the same choices in a bottom drawer. */
export const Narrow: Story = {
  decorators: [narrow],
};
