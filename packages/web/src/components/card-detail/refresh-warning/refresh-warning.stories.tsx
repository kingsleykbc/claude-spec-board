import type { Meta, StoryObj } from '@storybook/react-vite';
import { RefreshWarning } from './refresh-warning';

const meta = {
  title: 'CardDetail/RefreshWarning',
  component: RefreshWarning,
  args: { id: 'T-104' },
  decorators: [(Story) => <div className="p-10">{Story()}</div>],
} satisfies Meta<typeof RefreshWarning>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The spec text changed and no refresh ran: hover, focus or tap explains it and copies the command. */
export const Default: Story = {};
