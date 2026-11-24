import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { FileProblem } from './file-problem';

const meta = {
  title: 'Detail/FileProblem',
  component: FileProblem,
  args: {
    message: 'The subtask on line 18 is missing its checkbox…',
    path: '.specboard/specs/T-109-import-recipes-from-a-file/spec.md',
    onFix: fn(),
  },
  decorators: [
    (Story) => (
      <div className="max-w-[900px] bg-card p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FileProblem>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    expect(within(canvasElement).getByRole('button', { name: 'Ask Claude to fix' })).toBeTruthy();
  },
};

/** Just clicked: a spinner and Starting…, disabled, until the fix run has started or the start failed. */
export const Starting: Story = {
  args: { onFix: fn(() => new Promise<boolean>(() => undefined)) },
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole('button', { name: 'Ask Claude to fix' }));
    expect(await c.findByRole('button', { name: 'Starting…' })).toHaveProperty('disabled', true);
    expect(args.onFix).toHaveBeenCalledOnce();
  },
};
