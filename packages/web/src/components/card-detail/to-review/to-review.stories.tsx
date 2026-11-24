import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { recipeSpec } from '@/fixtures/recipeBox';
import { createMutator } from '@/state/mutate';
import { checkSpec } from './check-spec';
import { ToReview } from './to-review';

// The To review checklist: grouped items with their expected results, How to check steps, and Pass and Fail.

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
    client: {
      setReview: fn(async (_pid: string, id: string) => ({ hash: 'h2', spec: recipeSpec(id) })),
      setReviewFailed: fn(async (_pid: string, id: string) => ({ hash: 'h2', spec: recipeSpec(id) })),
    },
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
    expect(within(canvasElement).queryByRole('button', { name: 'Pass' })).toBeNull();
  },
};

/** Steps behind a How to check toggle, a failed check in red with Edit and Clear, and a fixed note. */
export const Checks: Story = {
  args: { spec: checkSpec() },
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    expect(c.getByText('1 failed')).toBeTruthy();
    expect(c.getByText('Failed: The list stays empty until I reload.')).toBeTruthy();
    expect(c.getByText('Fixed: The filter reset on reload (a1b2c3d)')).toBeTruthy();
    await userEvent.click(c.getAllByRole('button', { name: 'How to check' })[0]!);
    const link = c.getByRole('link', { name: 'the recipes page' });
    expect(link.getAttribute('href')).toBe('http://localhost:5173/recipes');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(c.getByRole('button', { name: 'Copy npm run dev' })).toBeTruthy();
    await userEvent.click(within(c.getByRole('group', { name: 'Check: Clear the search box' })).getByRole('button', { name: 'Clear' }));
    expect(args.client?.setReviewFailed).toHaveBeenCalledWith('p1', 'T-103', 2, expect.any(String), null);
  },
};

/** Fail opens "What went wrong?"; Save writes the reason as one line. */
export const FailFlow: Story = {
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    await userEvent.click(within(c.getByRole('group', { name: 'Check: Clear the search box' })).getByRole('button', { name: 'Fail' }));
    const box = c.getByLabelText('What went wrong?');
    const save = c.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    await userEvent.type(box, 'Nothing comes back');
    await userEvent.click(save);
    expect(args.client?.setReviewFailed).toHaveBeenCalledWith('p1', 'T-103', 2, expect.any(String), 'Nothing comes back');
  },
};

/** Pass ticks the item, like the checkbox. */
export const PassFlow: Story = {
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    await userEvent.click(within(c.getByRole('group', { name: 'Check: Clear the search box' })).getByRole('button', { name: 'Pass' }));
    expect(args.client?.setReview).toHaveBeenCalledWith('p1', 'T-103', 2, expect.any(String), true);
  },
};
