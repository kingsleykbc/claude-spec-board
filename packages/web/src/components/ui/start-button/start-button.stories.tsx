import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { PlayIcon } from '@/lib/icons';
import { StartButton } from './start-button';

const meta = {
  title: 'UI/StartButton',
  component: StartButton,
  args: {
    onStart: fn(),
    className: 'inline-flex h-[34px] cursor-pointer items-center gap-2 rounded-lg border-0 bg-accent px-3 text-[13px] font-semibold text-accent-fg disabled:cursor-default',
    children: (
      <>
        <PlayIcon aria-hidden className="text-[12px]" />
        Run with Claude
      </>
    ),
  },
  decorators: [(Story) => <div className="p-6">{Story()}</div>],
} satisfies Meta<typeof StartButton>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Ready: a click calls `onStart`. */
export const Ready: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Run with Claude' }));
    expect(args.onStart).toHaveBeenCalledOnce();
  },
};

/** The start is in flight: a spinner, "Starting…", and disabled, so a second click starts nothing. */
export const Starting: Story = {
  args: { onStart: fn(() => new Promise(() => undefined)) },
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole('button', { name: 'Run with Claude' }));
    const btn = await c.findByRole('button', { name: 'Starting…' });
    expect(btn).toHaveProperty('disabled', true);
    expect(c.getByTestId('spinner')).toBeTruthy();
    await userEvent.click(btn);
    expect(args.onStart).toHaveBeenCalledOnce();
  },
};

/** The start failed (the board shows the error toast): the button comes back. */
export const StartFailed: Story = {
  args: { onStart: fn(async () => false) },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole('button', { name: 'Run with Claude' }));
    await waitFor(() => expect(c.getByRole('button', { name: 'Run with Claude' })).toHaveProperty('disabled', false));
  },
};
