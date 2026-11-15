import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ConnectionBanner, Spinner } from './connection-banner';

const meta = { title: 'Shell/ConnectionBanner', component: ConnectionBanner, args: { conn: 'disconnected', onReconnect: fn() } } satisfies Meta<typeof ConnectionBanner>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Live: Story = { args: { conn: 'live' } };

export const Reconnecting: Story = {
  args: { conn: 'reconnecting' },
  play: async ({ canvasElement }) => {
    expect(within(canvasElement).getByTestId('spinner')).toBeTruthy();
  },
};

export const Disconnected: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Reconnect' }));
    expect(args.onReconnect).toHaveBeenCalled();
  },
};

/** The spinner on its own, as the switcher, run panel and dialogs use it. */
export const SpinnerAlone: StoryObj = { render: () => <Spinner /> };
