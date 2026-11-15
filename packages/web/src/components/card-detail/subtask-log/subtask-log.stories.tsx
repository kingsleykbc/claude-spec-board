import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { SubtaskLog } from './subtask-log';

const base = {
  subtask: 1,
  commit: '4f2a91c',
  pr: null,
  doneAt: null,
  tokens: null,
  obsolete: null,
  files: ['src/pages/Planner.tsx'],
  entries: [{ at: '2026-11-07 15:12', text: 'Built the planner page.' }],
  problems: [],
};

const meta = {
  title: 'Detail/SubtaskLog',
  component: SubtaskLog,
  decorators: [
    (Story) => (
      <div className="max-w-[860px] bg-card p-6">
        <Story />
      </div>
    ),
  ],
  args: { log: base },
} satisfies Meta<typeof SubtaskLog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithPrTokensAndDoneTime: Story = {
  name: 'With PR, tokens and done time',
  args: { log: { ...base, pr: 'https://github.com/o/r/pull/7', doneAt: '2026-11-07 15:40', tokens: 48200 } },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    expect(c.getByRole('link', { name: 'PR' }).getAttribute('href')).toBe('https://github.com/o/r/pull/7');
    expect(c.getByText('Done Nov 7, 15:40')).toBeTruthy();
    expect(c.getByText('48.2k tokens')).toBeTruthy();
  },
};

/** The warning icon opens a popover with the reason (it works on touch too). */
export const Obsolete: Story = {
  args: { log: { ...base, obsolete: { since: '2026-11-10', reason: 'Replaced by the new planner' } } },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Obsolete' }));
    const pop = await within(canvasElement.ownerDocument.body).findByRole('dialog', { name: 'Obsolete' });
    expect(within(pop).getByText('Since 2026-11-10: Replaced by the new planner')).toBeTruthy();
  },
};

export const ObsoleteNoDate: Story = {
  name: 'Obsolete without a date',
  args: { log: { ...base, obsolete: { since: null, reason: 'Dropped' } } },
};
