import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { RunButton } from './RunButton';

const meta = {
  title: 'Detail/RunButton',
  component: RunButton,
  args: { id: 'T-104', state: 'ready', onRun: fn(), onStop: fn() },
  decorators: [
    (Story) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 24, width: 520 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RunButton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: /Tell Claude to start/ }));
    expect(args.onRun).toHaveBeenCalled();
  },
};

export const Running: Story = {
  args: { state: 'running' },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Stop' }));
    expect(args.onStop).toHaveBeenCalled();
  },
};

export const Disabled: Story = {
  args: { state: 'disabled', runningId: 'T-103' },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    expect(c.getByText('Claude is already working on T-103')).toBeTruthy();
    expect((c.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  },
};

export const Fallback: Story = {
  args: { state: 'fallback' },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    expect(c.getByText('Claude Code not found')).toBeTruthy();
    await userEvent.click(c.getByRole('button', { name: '⧉ Copy command' }));
    expect(c.getByRole('button', { name: '✓ Copied: paste it into Claude Code' })).toBeTruthy();
  },
};
