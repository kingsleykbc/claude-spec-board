import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { recipeSpec } from '@/fixtures/recipeBox';
import { createMutator } from '@/state/mutate';
import { ToReview } from './to-review';

// The To review checklist: grouped items with their expected results.

const meta = {
  title: 'Detail/ToReview',
  component: ToReview,
  decorators: [
    (Story) => (
      <div className="max-w-[860px] bg-card p-6">
        <Story />
      </div>
    ),
  ],
  args: {
    pid: 'p1',
    spec: recipeSpec('T-103'),
    client: { setReview: fn(async (_pid: string, id: string) => ({ hash: 'h2', spec: recipeSpec(id) })) },
    mutate: createMutator(() => Promise.reject(new Error('no default op'))),
    refresh: fn(async () => undefined),
    toast: fn(),
  },
} satisfies Meta<typeof ToReview>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    expect(c.getByText('1 of 3 checked')).toBeTruthy();
    expect(c.getByText('Searching')).toBeTruthy();
    expect(c.getByText('Expected: All recipes come back.')).toBeTruthy();
  },
};

export const Toggle: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('checkbox', { name: 'Clear the search box' }));
    expect(args.client?.setReview).toHaveBeenCalled();
  },
};

export const Archived: Story = {
  args: { spec: { ...recipeSpec('T-103'), archived: true } },
  play: async ({ canvasElement }) => {
    for (const box of within(canvasElement).getAllByRole('checkbox')) expect((box as HTMLInputElement).disabled).toBe(true);
  },
};
