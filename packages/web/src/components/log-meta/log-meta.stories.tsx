import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { LogMeta } from './log-meta';

const meta = {
  title: 'Detail/LogMeta',
  component: LogMeta,
  decorators: [
    (Story) => (
      <div className="max-w-[260px] bg-card p-6">
        <Story />
      </div>
    ),
  ],
  args: { files: ['src/pages/Planner.tsx', 'src/lib/plan.ts'], commit: '4f2a91c', pr: 'https://github.com/o/r/pull/7', tokens: 48200 },
} satisfies Meta<typeof LogMeta>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Files, commit, PR link and tokens. */
export const Full: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    expect(c.getByText('src/lib/plan.ts')).toBeTruthy();
    expect(c.getByText('4f2a91c')).toBeTruthy();
    expect(c.getByRole('link', { name: 'PR' }).getAttribute('href')).toBe('https://github.com/o/r/pull/7');
    expect(c.getByText('48.2k tokens')).toBeTruthy();
  },
};

/** A PR that is not a URL is shown as text. */
export const PlainPr: Story = { args: { pr: '#7 (local)' } };

export const TokensOnly: Story = { args: { files: [], commit: null, pr: null } };
