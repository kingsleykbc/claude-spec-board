import type { Meta, StoryObj } from '@storybook/react-vite';
import { Switch } from './switch';

const meta = { title: 'UI/Switch', component: Switch } satisfies Meta<typeof Switch>;
export default meta;
type Story = StoryObj<typeof meta>;

/** An on/off switch with a visible label, as Blocked only and Simple mode use. */
export const Default: Story = {
  render: (args) => (
    <label className="flex items-center gap-2 p-6 text-sm text-fg2">
      <Switch {...args} />
      Blocked only
    </label>
  ),
};

/** Starts on. */
export const On: Story = { ...Default, args: { defaultChecked: true } };
