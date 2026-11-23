import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { DetailHeader } from './detail-header';

const meta = {
  title: 'Detail/DetailHeader',
  component: DetailHeader,
  args: {
    id: 'T-103',
    path: '.specboard/specs/T-103-search-and-filters/spec.md',
    title: 'Search & filters',
    status: 'review',
    urgency: 'high',
    categories: ['Frontend', 'Backend'],
    allCategories: ['Frontend', 'Backend', 'Auth', 'Infra'],
    runState: 'ready',
    onRun: fn(),
    onStop: fn(),
    onStatus: fn(),
    onUrgency: fn(),
    onAddCategory: fn(),
    onRemoveCategory: fn(),
    onClose: fn(),
  },
  decorators: [
    (Story) => (
      <div className="max-w-[900px] bg-card">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DetailHeader>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    expect(within(canvasElement).getByRole('heading', { level: 1, name: 'Search & filters' })).toBeTruthy();
  },
};

export const WithSync: Story = {
  name: 'With Sync and a waiting proposal',
  args: { onSync: fn(), syncWaiting: true, onSyncWaiting: fn() },
};

export const Simple: Story = {
  name: 'Simple mode',
  args: { simple: true, dependencies: <p className="m-0 text-[13px] text-fg3">Dependencies go here.</p> },
};

const LONG_PATH = '.specboard/specs/T-103-search-and-filters-with-a-very-long-folder-name/spec.md';

/** A draft: the Draft badge and Have Claude write this up sit in the actions row, beside the (held) Run buttons. */
export const Draft: Story = {
  args: { draft: true, onWriteUp: fn(), runHold: 'Draft. Have Claude write this up first.', status: 'todo' },
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    expect(c.getByText('Draft')).toBeTruthy();
    await userEvent.click(c.getByRole('button', { name: 'Have Claude write this up' }));
    expect(args.onWriteUp).toHaveBeenCalled();
  },
};

/** Claude isn’t connected: Run with Claude and Have Claude write this up are greyed, each with its own command. */
export const NotConnectedDraft: Story = {
  args: { draft: true, onWriteUp: fn(), manual: 'not-logged-in', status: 'todo' },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const run = c.getByRole('button', { name: 'Run with Claude' }) as HTMLButtonElement;
    const write = c.getByRole('button', { name: 'Have Claude write this up' }) as HTMLButtonElement;
    expect(run.disabled).toBe(false);
    expect(write.disabled).toBe(false);
    await userEvent.click(write);
    expect(await within(document.body).findByText('/specboard:create-spec T-103')).toBeTruthy();
    await userEvent.keyboard('{Escape}');
  },
};

/** 320px wide with a long path: the close button stays in the frame and the actions row wraps. */
export const Narrow: Story = {
  args: { path: LONG_PATH, draft: true, onWriteUp: fn(), onSync: fn(), syncWaiting: true, onSyncWaiting: fn(), status: 'todo' },
  decorators: [
    (Story) => (
      <div className="relative w-[320px] max-w-[320px] overflow-hidden bg-card">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const frame = canvasElement.querySelector('.max-w-\[320px\]')!.getBoundingClientRect();
    const close = within(canvasElement).getByRole('button', { name: 'Close' }).getBoundingClientRect();
    expect(close.right).toBeLessThanOrEqual(frame.right);
    expect(close.left).toBeGreaterThanOrEqual(frame.left);
    const actions = within(canvasElement).getByTestId('detail-actions');
    const tops = new Set([...actions.children].map((el) => Math.round(el.getBoundingClientRect().top)));
    expect(tops.size).toBeGreaterThan(1);
  },
};

/** Archive (and Unarchive on an archived spec) is in the ⋯ menu for any status. */
export const WithArchive: Story = {
  args: { onArchive: fn(), onUnarchive: fn(), status: 'doing' },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Card actions' }));
    await userEvent.click(await within(document.body).findByRole('menuitem', { name: 'Archive' }));
    expect(args.onArchive).toHaveBeenCalled();
  },
};
