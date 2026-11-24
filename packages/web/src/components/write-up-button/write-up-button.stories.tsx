import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { WriteUpButton } from './write-up-button';

const meta = {
  title: 'Board/WriteUpButton',
  component: WriteUpButton,
  args: { id: 'T-108', manual: null, statusKnown: true, onWriteUp: fn() },
  decorators: [(Story) => <div className="p-6">{Story()}</div>],
} satisfies Meta<typeof WriteUpButton>;
export default meta;
type Story = StoryObj<typeof meta>;

/** On a draft card: a click starts a write-up run. */
export const Ready: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Have Claude write this up' }));
    expect(args.onWriteUp).toHaveBeenCalledOnce();
  },
};

/** The card detail's larger size. */
export const Medium: Story = { args: { size: 'md' } };

/** Just clicked: a spinner and Starting…, disabled, until the write-up has started or the start failed. */
export const Starting: Story = {
  args: { onWriteUp: fn(() => new Promise<boolean>(() => undefined)) },
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole('button', { name: 'Have Claude write this up' }));
    const btn = await c.findByRole('button', { name: 'Starting…' });
    expect(btn).toHaveProperty('disabled', true);
    await userEvent.click(btn);
    expect(args.onWriteUp).toHaveBeenCalledOnce();
  },
};

/** Not connected: greyed, and a click shows the command to paste instead. */
export const NotConnected: Story = {
  args: { manual: 'not-approved' },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Have Claude write this up' }));
    expect(await within(document.body).findByText('/create-spec T-108')).toBeTruthy();
    expect(args.onWriteUp).not.toHaveBeenCalled();
  },
};

/** Another run is going: disabled, with the same note Run with Claude shows. */
export const Busy: Story = {
  args: { busyNote: 'Claude is already working on T-002' },
  play: async ({ canvasElement, args }) => {
    const btn = within(canvasElement).getByRole('button', { name: 'Have Claude write this up' });
    expect(btn).toHaveProperty('disabled', true);
    expect(btn.getAttribute('title')).toBe('Claude is already working on T-002');
    expect(args.onWriteUp).not.toHaveBeenCalled();
  },
};
