import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { composeStories } from '@storybook/react-vite';
import * as stories from './run-button.stories';

const { Ready } = composeStories(stories);

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('RunButton', () => {
  it('ready: "Run in background" calls onRun', () => {
    const onRun = vi.fn();
    render(<Ready id="T-104" state="ready" onRun={onRun} onStop={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Run in background' }));
    expect(onRun).toHaveBeenCalled();
  });

  it('ready: two secondary buttons of equal weight; Copy run command copies the command and starts nothing', async () => {
    const onRun = vi.fn();
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<Ready id="T-104" state="ready" onRun={onRun} onStop={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['Run in background', 'Copy run command']);
    // Neither is the primary (filled) button.
    expect(buttons[0]!.className).toBe(buttons[1]!.className);
    await act(async () => {
      fireEvent.click(buttons[1]!);
    });
    expect(writeText).toHaveBeenCalledWith('/run-spec T-104');
    expect(onRun).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Copied: paste it into your Claude chat' })).toBeTruthy();
  });

  it('ready: both are explained, in tooltips and in the docs', async () => {
    const user = userEvent.setup();
    render(<Ready id="T-104" state="ready" onRun={vi.fn()} onStop={vi.fn()} />);
    await user.hover(screen.getByRole('button', { name: 'Copy run command' }));
    await waitFor(() => expect(screen.getByRole('tooltip').textContent).toMatch(/You see all the work in that chat/));
    cleanup();
    render(<Ready id="T-104" state="ready" onRun={vi.fn()} onStop={vi.fn()} />);
    await user.hover(screen.getByRole('button', { name: 'Run in background' }));
    await waitFor(() => expect(screen.getByRole('tooltip').textContent).toMatch(/ignores the project’s and your Claude settings/));
    const help = screen.getByRole('link', { name: 'Chat or background: which to use' });
    expect(help.getAttribute('href')).toBe('/docs/running-specs');
    expect(help.getAttribute('target')).toBe('_blank');
  });

  it('running: "Stop" calls onStop', () => {
    const onStop = vi.fn();
    render(<Ready id="T-104" state="running" onRun={vi.fn()} onStop={onStop} />);
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(onStop).toHaveBeenCalled();
  });

  it('held back: says why, and the button starts nothing', () => {
    const onRun = vi.fn();
    render(<Ready id="T-104" state="ready" hold="Draft. Have Claude write this up first." onRun={onRun} onStop={vi.fn()} />);
    expect(screen.getByText('Draft. Have Claude write this up first.')).toBeTruthy();
    const button = screen.getByRole('button', { name: /Copy run command/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(onRun).not.toHaveBeenCalled();
  });

  it('a hold changes nothing while running', () => {
    render(<Ready id="T-104" state="running" hold="Blocked." onRun={vi.fn()} onStop={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Stop' })).toBeTruthy();
    expect(screen.queryByText('Blocked.')).toBeNull();
  });

  it('disabled: says which spec Claude is working on', () => {
    render(<Ready id="T-104" state="disabled" runningId="T-103" onRun={vi.fn()} onStop={vi.fn()} />);
    expect(screen.getByText('Claude is already working on T-103')).toBeTruthy();
    expect((screen.getByRole('button', { name: /Copy run command/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('fallback with a note shows it in place of "not found"', () => {
    render(<Ready id="T-104" state="fallback" blockedNote="Held back for a reason." onRun={vi.fn()} onStop={vi.fn()} />);
    expect(screen.getByText('Held back for a reason.')).toBeTruthy();
    expect(screen.queryByText('Claude Code not found')).toBeNull();
    expect(screen.getByRole('button', { name: 'Copy run command' })).toBeTruthy();
  });

  it('fallback copies the command and confirms for 2.6 s', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<Ready id="T-104" state="fallback" onRun={vi.fn()} onStop={vi.fn()} />);
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
    render(<Ready id="T-104" state="fallback" onRun={vi.fn()} onStop={vi.fn()} />);
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
    render(<Ready id="T-104" state="fallback" onRun={vi.fn()} onStop={vi.fn()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy run command' }));
    });
    expect(failedNote().textContent).toBe('Copy failed: paste /run-spec T-104 into your Claude chat');
    expect(screen.queryByText('Copied: paste it into your Claude chat')).toBeNull();
  });

  it('no clipboard API at all shows "Copy failed"', () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    render(<Ready id="T-104" state="fallback" onRun={vi.fn()} onStop={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy run command' }));
    expect(failedNote()).toBeTruthy();
  });
});
