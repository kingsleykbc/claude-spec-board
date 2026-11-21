import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { composeStories } from '@storybook/react-vite';
import * as stories from './run-button.stories';
import { NOT_CONNECTED_TITLE } from '@/components/not-connected/not-connected';

const { Ready } = composeStories(stories);
const base = { id: 'T-104', manual: null, statusKnown: true, onRun: vi.fn(), onStop: vi.fn() } as const;

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('RunButton', () => {
  it('ready and connected: the filled "Run with Claude" calls onRun, and Copy run command stays secondary', () => {
    const onRun = vi.fn();
    render(<Ready {...base} state="ready" onRun={onRun} />);
    const run = screen.getByRole('button', { name: 'Run with Claude' });
    expect(run.className).toMatch(/bg-accent/);
    expect(screen.getByRole('button', { name: 'Copy run command' }).className).not.toMatch(/bg-accent/);
    fireEvent.click(run);
    expect(onRun).toHaveBeenCalled();
  });

  it('ready and not connected: Run with Claude starts nothing and opens the notice with the reason', async () => {
    const user = userEvent.setup();
    const onRun = vi.fn();
    render(<Ready {...base} state="ready" manual="not-approved" onRun={onRun} />);
    await user.click(screen.getByRole('button', { name: 'Run with Claude' }));
    expect(onRun).not.toHaveBeenCalled();
    const notice = await screen.findByRole('dialog', { name: NOT_CONNECTED_TITLE });
    expect(notice.textContent).toMatch(NOT_CONNECTED_TITLE);
    expect(notice.textContent).toMatch("This project isn't set up for background runs.");
    expect(screen.getByRole('button', { name: 'Copy run command' })).toBeTruthy();
  });

  it('status unknown: a click starts nothing and opens nothing', async () => {
    const user = userEvent.setup();
    const onRun = vi.fn();
    render(<Ready {...base} state="ready" manual="not-approved" statusKnown={false} onRun={onRun} />);
    await user.click(screen.getByRole('button', { name: 'Run with Claude' }));
    expect(onRun).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('fallback with a reason still offers Run with Claude, which opens the notice', async () => {
    const user = userEvent.setup();
    render(<Ready {...base} state="fallback" manual="not-installed" />);
    await user.click(screen.getByRole('button', { name: 'Run with Claude' }));
    expect((await screen.findByRole('dialog', { name: NOT_CONNECTED_TITLE })).textContent).toMatch("Claude Code isn't installed on this computer.");
  });

  it('ready: Copy run command copies the command and starts nothing', async () => {
    const onRun = vi.fn();
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<Ready {...base} id="T-104" state="ready" onRun={onRun} onStop={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['Run with Claude', 'Copy run command']);
    await act(async () => {
      fireEvent.click(buttons[1]!);
    });
    expect(writeText).toHaveBeenCalledWith('/run-spec T-104');
    expect(onRun).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Copied: paste it into your Claude chat' })).toBeTruthy();
  });

  it('ready: both are explained, in tooltips and in the docs', async () => {
    const user = userEvent.setup();
    render(<Ready {...base} id="T-104" state="ready" onRun={vi.fn()} onStop={vi.fn()} />);
    await user.hover(screen.getByRole('button', { name: 'Copy run command' }));
    await waitFor(() => expect(screen.getByRole('tooltip').textContent).toMatch(/You see all the work in that chat/));
    cleanup();
    render(<Ready {...base} id="T-104" state="ready" onRun={vi.fn()} onStop={vi.fn()} />);
    await user.hover(screen.getByRole('button', { name: 'Run with Claude' }));
    await waitFor(() => expect(screen.getByRole('tooltip').textContent).toMatch(/ignores the project’s and your Claude settings/));
    const help = screen.getByRole('link', { name: 'Chat or background: which to use' });
    expect(help.getAttribute('href')).toBe('/docs/running-specs');
    expect(help.getAttribute('target')).toBe('_blank');
  });

  it('running: "Stop" calls onStop', () => {
    const onStop = vi.fn();
    render(<Ready {...base} id="T-104" state="running" onRun={vi.fn()} onStop={onStop} />);
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(onStop).toHaveBeenCalled();
  });

  it('held back: says why, and the button starts nothing', () => {
    const onRun = vi.fn();
    render(<Ready {...base} id="T-104" state="ready" hold="Draft. Have Claude write this up first." onRun={onRun} onStop={vi.fn()} />);
    expect(screen.getByText('Draft. Have Claude write this up first.')).toBeTruthy();
    const button = screen.getByRole('button', { name: /Copy run command/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(onRun).not.toHaveBeenCalled();
  });

  it('a hold changes nothing while running', () => {
    render(<Ready {...base} id="T-104" state="running" hold="Blocked." onRun={vi.fn()} onStop={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Stop' })).toBeTruthy();
    expect(screen.queryByText('Blocked.')).toBeNull();
  });

  it('disabled: says which spec Claude is working on', () => {
    render(<Ready {...base} id="T-104" state="disabled" runningId="T-103" onRun={vi.fn()} onStop={vi.fn()} />);
    expect(screen.getByText('Claude is already working on T-103')).toBeTruthy();
    expect((screen.getByRole('button', { name: /Copy run command/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('fallback with a note shows it in place of "not found"', () => {
    render(<Ready {...base} id="T-104" state="fallback" blockedNote="Held back for a reason." onRun={vi.fn()} onStop={vi.fn()} />);
    expect(screen.getByText('Held back for a reason.')).toBeTruthy();
    expect(screen.queryByText('Claude Code not found')).toBeNull();
    expect(screen.getByRole('button', { name: 'Copy run command' })).toBeTruthy();
  });

  it('fallback copies the command and confirms for 2.6 s', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<Ready {...base} id="T-104" state="fallback" onRun={vi.fn()} onStop={vi.fn()} />);
    expect(screen.getByText('Claude Code not found')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy run command' }));
    });
    expect(writeText).toHaveBeenCalledWith('/run-spec T-104');
    expect(screen.getByRole('button', { name: 'Copied: paste it into your Claude chat' })).toBeTruthy();
    act(() => vi.advanceTimersByTime(2599));
    expect(screen.getByRole('button', { name: 'Copied: paste it into your Claude chat' })).toBeTruthy();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole('button', { name: 'Copy run command' })).toBeTruthy();
  });

  const failedNote = () => screen.getByTestId('copy-failed');

  it('a clipboard that throws shows "Copy failed" with the selectable command for 6 s', () => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: () => {
          throw new Error('denied');
        },
      },
      configurable: true,
    });
    render(<Ready {...base} id="T-104" state="fallback" onRun={vi.fn()} onStop={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy run command' }));
    expect(failedNote().textContent).toBe('Copy failed: paste /run-spec T-104 into your Claude chat');
    expect(screen.getByText('/run-spec T-104').className).toMatch(/select-all/);
    expect(screen.queryByText('Copied: paste it into your Claude chat')).toBeNull();
    expect(screen.queryByText('Claude Code not found')).toBeNull();
    act(() => vi.advanceTimersByTime(5999));
    expect(failedNote()).toBeTruthy();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByTestId('copy-failed')).toBeNull();
    expect(screen.getByText('Claude Code not found')).toBeTruthy();
  });

  it('a rejected clipboard promise shows "Copy failed"', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.reject(new Error('denied')) },
      configurable: true,
    });
    render(<Ready {...base} id="T-104" state="fallback" onRun={vi.fn()} onStop={vi.fn()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy run command' }));
    });
    expect(failedNote().textContent).toBe('Copy failed: paste /run-spec T-104 into your Claude chat');
    expect(screen.queryByText('Copied: paste it into your Claude chat')).toBeNull();
  });

  it('no clipboard API at all shows "Copy failed"', () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    render(<Ready {...base} id="T-104" state="fallback" onRun={vi.fn()} onStop={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy run command' }));
    expect(failedNote()).toBeTruthy();
  });
});
