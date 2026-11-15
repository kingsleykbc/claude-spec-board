import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { Urgency } from './urgency';

const meta = { title: 'UI/Urgency', component: Urgency, args: { level: 'urgent' } } satisfies Meta<typeof Urgency>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Urgent: the accent chip. */
export const Default: Story = {
  decorators: [(Story) => <div className="p-6">{Story()}</div>],
};

function Levels() {
  return (
    <div className="flex flex-wrap">
      {(['light', 'dark'] as const).map((t) => (
        <div key={t} data-theme={t} className="flex flex-col gap-3 bg-card p-6 font-sans text-fg">
          {(['urgent', 'high', 'normal', 'low'] as const).map((u) => (
            <Urgency key={u} level={u} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Every level, in both themes. */
export const AllLevels: Story = {
  render: () => <Levels />,
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    for (const label of ['Urgent', 'High', 'Normal', 'Low']) expect(c.getAllByText(label)).toHaveLength(2);
  },
};
