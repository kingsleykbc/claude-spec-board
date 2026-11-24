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

/** Just clicked: a spinner and Starting…, disabled, until the run has started (then Stop) or the start failed. */
export const Starting: Story = {
  args: { onRun: fn(() => new Promise<boolean>(() => undefined)) },
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole('button', { name: 'Run with Claude' }));
    const btn = await c.findByRole('button', { name: 'Starting…' });
    expect(btn).toHaveProperty('disabled', true);
    await userEvent.click(btn);
    expect(args.onRun).toHaveBeenCalledOnce();
  },
};

/** Greyed, but not disabled: hover, focus or a click opens why Claude isn’t connected and the command to paste. */
export const NotConnected: Story = {
  args: { manual: 'not-approved' },
  play: async ({ canvasElement, args }) => {
    const run = within(canvasElement).getByRole('button', { name: 'Run with Claude' }) as HTMLButtonElement;
    expect(run.disabled).toBe(false);
    await userEvent.click(run);
    expect(await within(document.body).findByText("This project isn't set up for background runs.")).toBeTruthy();
    expect(within(document.body).getByText('/run-spec T-104')).toBeTruthy();
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
    expect(await c.findByRole('button', { name: 'Copied' })).toBeTruthy();
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

/** A card in Review with a failed check: the orange Fix review issues replaces the held Run with Claude. */
export const FixReview: Story = {
  args: { fix: true, hold: 'In Review: check the work, then move the card to Done.' },
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    expect(c.queryByText('In Review: check the work, then move the card to Done.')).toBeNull();
    const fix = c.getByRole('button', { name: 'Fix review issues' });
    expect(fix.className).toMatch(/bg-accent/);
    await userEvent.click(fix);
    expect(args.onRun).toHaveBeenCalled();
  },
};

/** Not connected: Fix review issues opens the notice with `/fix-review <ID>` to paste, and starts nothing. */
export const FixReviewNotConnected: Story = {
  args: { fix: true, manual: 'not-approved' },
  play: async ({ canvasElement, args }) => {
    stubClipboard(async () => undefined);
    const fix = within(canvasElement).getByRole('button', { name: 'Fix review issues' }) as HTMLButtonElement;
    await userEvent.click(fix);
    expect(await within(document.body).findByText('/fix-review T-104')).toBeTruthy();
    expect(args.onRun).not.toHaveBeenCalled();
  },
};
