import type { Meta, StoryObj } from '@storybook/react-vite';
import { LuSettings } from 'react-icons/lu';
import { Hint } from './hint';

const meta = {
  title: 'UI/Hint',
  component: Hint,
  args: {
    label: 'Settings',
    children: (
      <button type="button" className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border border-line bg-transparent p-0 text-fg hover:bg-panel">
        <LuSettings className="block size-4" aria-hidden="true" />
      </button>
    ),
  },
  decorators: [(Story) => <div className="p-10">{Story()}</div>],
} satisfies Meta<typeof Hint>;
export default meta;
type Story = StoryObj<typeof meta>;

/** An icon-only button: the label shows on hover or focus, and names the button. */
export const Default: Story = {};

/** The trigger already has its own accessible name; the hint keeps it. */
export const OwnLabel: Story = {
  args: {
    label: 'Open settings (,)',
    side: 'bottom',
    children: (
      <button type="button" aria-label="Settings" className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border border-line bg-transparent p-0 text-fg hover:bg-panel">
        <LuSettings className="block size-4" aria-hidden="true" />
      </button>
    ),
  },
};
