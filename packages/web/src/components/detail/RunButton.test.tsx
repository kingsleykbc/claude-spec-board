import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RunButton } from './RunButton';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('RunButton', () => {
  it('ready: "▶ Tell Claude to start" calls onRun', () => {
    const onRun = vi.fn();
    render(<RunButton id="T-104" state="ready" onRun={onRun} onStop={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: '▶ Tell Claude to start' }));
    expect(onRun).toHaveBeenCalled();
  });

  it('running: "Stop" calls onStop', () => {
    const onStop = vi.fn();
    render(<RunButton id="T-104" state="running" onRun={() => undefined} onStop={onStop} />);
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(onStop).toHaveBeenCalled();
  });

  it('held back: says why, and the button starts nothing', () => {
    const onRun = vi.fn();
    render(<RunButton id="T-104" state="ready" hold="Draft. Have Claude write this up first." onRun={onRun} onStop={() => undefined} />);
    expect(screen.getByText('Draft. Have Claude write this up first.')).toBeTruthy();
    const button = screen.getByRole('button', { name: /Tell Claude to start/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(onRun).not.toHaveBeenCalled();
  });

  it('a hold changes nothing while running', () => {
    render(<RunButton id="T-104" state="running" hold="Blocked." onRun={() => undefined} onStop={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Stop' })).toBeTruthy();
    expect(screen.queryByText('Blocked.')).toBeNull();
  });

  it('disabled: says which spec Claude is working on', () => {
    render(<RunButton id="T-104" state="disabled" runningId="T-103" onRun={() => undefined} onStop={() => undefined} />);
    expect(screen.getByText('Claude is already working on T-103')).toBeTruthy();
    expect((screen.getByRole('button', { name: /Tell Claude to start/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('fallback copies the command and confirms for 2.6 s', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<RunButton id="T-104" state="fallback" onRun={() => undefined} onStop={() => undefined} />);
    expect(screen.getByText('Claude Code not found')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '⧉ Copy command' }));
    });
    expect(writeText).toHaveBeenCalledWith('claude "/run-spec T-104"');
    expect(screen.getByRole('button', { name: '✓ Copied: paste it into Claude Code' })).toBeTruthy();
    act(() => vi.advanceTimersByTime(2599));
    expect(screen.getByRole('button', { name: '✓ Copied: paste it into Claude Code' })).toBeTruthy();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole('button', { name: '⧉ Copy command' })).toBeTruthy();
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
    render(<RunButton id="T-104" state="fallback" onRun={() => undefined} onStop={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: '⧉ Copy command' }));
    expect(failedNote().textContent).toBe('Copy failed: run claude "/run-spec T-104"');
    expect(screen.getByText('claude "/run-spec T-104"').style.userSelect).toBe('all');
    expect(screen.queryByText('✓ Copied: paste it into Claude Code')).toBeNull();
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
    render(<RunButton id="T-104" state="fallback" onRun={() => undefined} onStop={() => undefined} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '⧉ Copy command' }));
    });
    expect(failedNote().textContent).toBe('Copy failed: run claude "/run-spec T-104"');
    expect(screen.queryByText('✓ Copied: paste it into Claude Code')).toBeNull();
  });

  it('no clipboard API at all shows "Copy failed"', () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    render(<RunButton id="T-104" state="fallback" onRun={() => undefined} onStop={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: '⧉ Copy command' }));
    expect(failedNote()).toBeTruthy();
  });
});
