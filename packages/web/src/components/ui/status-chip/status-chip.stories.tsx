import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { StatusChip } from './status-chip';

const meta = { title: 'UI/StatusChip', component: StatusChip, args: { status: 'doing' } } satisfies Meta<typeof StatusChip>;
export default meta;
type Story = StoryObj<typeof meta>;

/** One chip. */
export const Default: Story = {};

/** The Blocked pill. */
export const Blocked: Story = { args: { status: 'blocked' } };

function Chips() {
  return (
    <div className="flex flex-wrap">
      {(['light', 'dark'] as const).map((t) => (
        <div key={t} data-theme={t} className="flex gap-1.5 bg-bg p-6 font-sans text-fg">
          {(['todo', 'doing', 'review', 'done', 'blocked'] as const).map((s) => (
            <StatusChip key={s} status={s} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Every status, in both themes. */
export const StatusChips: Story = {
  render: () => <Chips />,
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    for (const l of ['To-do', 'Doing', 'Review', 'Done', 'Blocked']) expect(c.getAllByText(new RegExp(l))).toHaveLength(2);
  },
};
