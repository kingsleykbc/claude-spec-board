import type { Meta, StoryObj } from '@storybook/react-vite';
import { LuInfo } from 'react-icons/lu';
import { InfoPopover } from './info-popover';

const meta = {
  title: 'UI/InfoPopover',
  component: InfoPopover,
  args: {
    label: 'Why is this card obsolete?',
    title: 'Obsolete',
    trigger: <LuInfo className="block size-4" aria-hidden="true" />,
    children: 'Replaced by T-104, which covers the same ground.',
  },
  decorators: [(Story) => <div className="p-10">{Story()}</div>],
} satisfies Meta<typeof InfoPopover>;
export default meta;
type Story = StoryObj<typeof meta>;

/** An indicator that explains itself on hover or keyboard focus, and on click or tap. */
export const Default: Story = {};

/** No title: the content alone. */
export const Untitled: Story = { args: { title: undefined } };
