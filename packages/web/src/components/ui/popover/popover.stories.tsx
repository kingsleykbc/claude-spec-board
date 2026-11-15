import type { Meta, StoryObj } from '@storybook/react-vite';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

const meta = { title: 'UI/Popover', component: Popover } satisfies Meta<typeof Popover>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Click-to-open information, e.g. why a card is obsolete. */
export const Default: Story = {
  render: () => (
    <div className="p-6">
      <Popover>
        <PopoverTrigger className="rounded-md border border-line bg-card px-3 py-1.5 text-fg">Why obsolete?</PopoverTrigger>
        <PopoverContent>
          <p className="m-0 text-sm">Replaced by T-104, which covers the same ground.</p>
        </PopoverContent>
      </Popover>
    </div>
  ),
};
