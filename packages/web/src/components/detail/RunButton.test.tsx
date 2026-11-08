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
    fireEvent.click(screen.getByRole('button', { name: '⧉ Copy command' }));
    expect(writeText).toHaveBeenCalledWith('claude "/run-spec T-104"');
    expect(screen.getByRole('button', { name: '✓ Copied: paste it into Claude Code' })).toBeTruthy();
    act(() => vi.advanceTimersByTime(2599));
    expect(screen.getByRole('button', { name: '✓ Copied: paste it into Claude Code' })).toBeTruthy();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole('button', { name: '⧉ Copy command' })).toBeTruthy();
  });

  it('fallback still confirms when the clipboard throws', () => {
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
    expect(screen.getByRole('button', { name: '✓ Copied: paste it into Claude Code' })).toBeTruthy();
  });
});
