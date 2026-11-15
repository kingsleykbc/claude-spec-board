import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { CategoryEditor } from './category-editor';

const meta = {
  title: 'Detail/CategoryEditor',
  component: CategoryEditor,
  args: { categories: ['Frontend'], all: ['Frontend', 'Backend', 'Auth', 'Infra'], onAdd: fn(), onRemove: fn() },
  decorators: [
    (Story) => (
      <div className="h-[200px] bg-card p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CategoryEditor>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Adding: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole('button', { name: 'Category' }));
    await userEvent.type(c.getByPlaceholderText('Category…'), 'Pay');
    expect(c.getByRole('option', { name: 'Create “Pay”' })).toBeTruthy();
  },
};
