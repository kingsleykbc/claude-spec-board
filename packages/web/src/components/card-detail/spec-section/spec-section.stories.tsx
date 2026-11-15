import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { recipeSpec } from '@/fixtures/recipeBox';
import { SpecSection } from './spec-section';

const md = recipeSpec('T-105').bodyMd;

const meta = {
  title: 'Detail/SpecSection',
  component: SpecSection,
  args: { md, text: null, onEdit: fn(), onChange: fn(), onCancel: fn(), onSave: fn() },
  decorators: [
    (Story) => (
      <div className="max-w-[900px] bg-card p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SpecSection>;
export default meta;
type Story = StoryObj<typeof meta>;

export const View: Story = {
  play: async ({ canvasElement }) => {
    expect(within(canvasElement).getByText('SPEC')).toBeTruthy();
  },
};

export const Editing: Story = {
  args: { text: md },
  play: async ({ canvasElement }) => {
    expect(within(canvasElement).getByRole('textbox', { name: 'Spec markdown' })).toBeTruthy();
  },
};
