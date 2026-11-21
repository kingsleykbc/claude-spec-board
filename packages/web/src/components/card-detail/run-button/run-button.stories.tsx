import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { RunButton } from './run-button';

const meta = {
  title: 'Detail/RunButton',
  component: RunButton,
  args: { id: 'T-104', state: 'ready', manual: null, statusKnown: true, onRun: fn(), onStop: fn() },
  decorators: [
    (Story) => (
      <div className="flex w-[520px] items-center gap-2.5 p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RunButton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: /Run with Claude/ }));
    expect(args.onRun).toHaveBeenCalled();
  },
};

export const NotConnected: Story = {
  args: { manual: 'not-approved' },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Run with Claude' }));
    expect(await within(document.body).findByText("This project isn't set up for background runs.")).toBeTruthy();
    expect(args.onRun).not.toHaveBeenCalled();
  },
};

export const StatusUnknown: Story = {
  args: { statusKnown: false },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Run with Claude' }));
    expect(args.onRun).not.toHaveBeenCalled();
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

/** Replace the browser clipboard for one story (headless Chromium may refuse the real one). */
const stubClipboard = (writeText: (t: string) => Promise<void>) =>
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

export const Fallback: Story = {
  args: { state: 'fallback' },
  play: async ({ canvasElement }) => {
    stubClipboard(async () => undefined);
    const c = within(canvasElement);
    expect(c.getByText('Claude Code not found')).toBeTruthy();
    await userEvent.click(c.getByRole('button', { name: 'Copy run command' }));
    expect(await c.findByRole('button', { name: 'Copied: paste it into your Claude chat' })).toBeTruthy();
  },
};

export const Blocked: Story = {
  args: { state: 'fallback', blockedNote: 'Claude Code is inside a registered project (C:\\Projects\\repo\\.venv\\Scripts\\claude.cmd), so runs won’t use it.' },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    expect(c.getByText(/Claude Code is inside a registered project/)).toBeTruthy();
  },
};

export const CopyFailed: Story = {
  args: { state: 'fallback' },
  play: async ({ canvasElement }) => {
    stubClipboard(() => Promise.reject(new Error('denied')));
    const c = within(canvasElement);
    await userEvent.click(c.getByRole('button', { name: 'Copy run command' }));
    const note = await c.findByTestId('copy-failed');
    expect(note.textContent).toBe('Copy failed: paste /run-spec T-104 into your Claude chat');
  },
};

export const HeldBack: Story = {
  args: { hold: 'Blocked. Awaiting answers on: No. of versions' },
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    expect(c.getByText('Blocked. Awaiting answers on: No. of versions')).toBeTruthy();
    const button = c.getByRole('button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    await userEvent.click(button);
    expect(args.onRun).not.toHaveBeenCalled();
  },
};
