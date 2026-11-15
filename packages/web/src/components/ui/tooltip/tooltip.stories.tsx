import type { Meta, StoryObj } from '@storybook/react-vite';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

const meta = { title: 'UI/Tooltip', component: Tooltip } satisfies Meta<typeof Tooltip>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A hover/focus label for an icon-only button. The preview decorator supplies the TooltipProvider. */
export const Default: Story = {
  render: () => (
    <div className="p-10">
      <Tooltip>
        <TooltipTrigger className="rounded-md border border-line bg-card px-3 py-1.5 text-fg" aria-label="Logs">
          ≡
        </TooltipTrigger>
        <TooltipContent>Logs</TooltipContent>
      </Tooltip>
    </div>
  ),
};
