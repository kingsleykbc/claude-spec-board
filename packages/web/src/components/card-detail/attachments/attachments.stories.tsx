import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { recipeSpec } from '@/fixtures/recipeBox';
import { Attachments } from './attachments';

// Images in the spec's images/ folder that the spec text doesn't use.

const meta = {
  title: 'Detail/Attachments',
  component: Attachments,
  decorators: [
    (Story) => (
      <div className="max-w-[860px] bg-card p-6">
        <Story />
      </div>
    ),
  ],
  args: {
    pid: 'p1',
    spec: recipeSpec('T-104'),
    client: { uploadImage: fn(async () => ({ path: 'images/x.png' })), deleteImage: fn(async () => undefined) },
    refresh: fn(async () => undefined),
    toast: fn(),
  },
} satisfies Meta<typeof Attachments>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    expect(c.getByRole('button', { name: 'View wireframe.svg' })).toBeTruthy();
    expect(c.getByRole('button', { name: 'Add image' })).toBeTruthy();
  },
};

export const Empty: Story = {
  args: { spec: { ...recipeSpec('T-105'), attachments: [] } },
  play: async ({ canvasElement }) => {
    expect(within(canvasElement).getByText('No attachments. Add images Claude should look at.')).toBeTruthy();
  },
};

export const Archived: Story = {
  args: { spec: { ...recipeSpec('T-104'), archived: true } },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    expect(c.queryByRole('button', { name: 'Add image' })).toBeNull();
    expect(c.queryByRole('button', { name: /^Delete / })).toBeNull();
  },
};
