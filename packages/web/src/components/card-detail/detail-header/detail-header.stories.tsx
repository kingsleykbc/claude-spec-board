import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
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
