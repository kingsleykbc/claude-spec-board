import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { composeStories } from '@storybook/react-vite';
import * as stories from './start-button.stories';
import { useStarting } from './start-button';

const { Ready } = composeStories(stories);

afterEach(cleanup);

/** A promise and the function that settles it. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('StartButton', () => {
  it('shows a spinner and Starting…, disabled, from the click until the start settles', async () => {
    const d = deferred<boolean>();
    const onStart = vi.fn(() => d.promise);
    render(<Ready onStart={onStart} />);
    fireEvent.click(screen.getByRole('button', { name: 'Run with Claude' }));
    const btn = screen.getByRole('button', { name: 'Starting…' });
    expect(btn).toHaveProperty('disabled', true);
    expect(btn.getAttribute('aria-busy')).toBe('true');
    expect(screen.getByTestId('spinner')).toBeTruthy();
    fireEvent.click(btn);
    expect(onStart).toHaveBeenCalledOnce();
    await act(async () => d.resolve(false));
    expect(screen.getByRole('button', { name: 'Run with Claude' })).toHaveProperty('disabled', false);
  });

  it('comes back after a rejected start too', async () => {
    const d = deferred<boolean>();
    render(<Ready onStart={vi.fn(() => d.promise)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Run with Claude' }));
    await act(async () => d.reject(new Error('nope')));
    expect(screen.getByRole('button', { name: 'Run with Claude' })).toHaveProperty('disabled', false);
  });

  it('keeps an aria-label while ready and uses Starting… as the name while starting', () => {
    render(<Ready onStart={vi.fn(() => new Promise(() => undefined))} aria-label="Fix review issues" />);
    fireEvent.click(screen.getByRole('button', { name: 'Fix review issues' }));
    expect(screen.getByRole('button', { name: 'Starting…' })).toBeTruthy();
  });

  it('calls an onClick it is given (a tooltip trigger’s) as well', () => {
    const onClick = vi.fn();
    const onStart = vi.fn();
    render(<Ready onStart={onStart} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Run with Claude' }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(onStart).toHaveBeenCalledOnce();
  });
});

describe('useStarting', () => {
  it('a second start while the first is in flight does nothing', async () => {
    const d = deferred<void>();
    const onStart = vi.fn(() => d.promise);
    const { result } = renderHook(() => useStarting(onStart));
    act(() => result.current.start());
    act(() => result.current.start());
    expect(onStart).toHaveBeenCalledOnce();
    expect(result.current.starting).toBe(true);
    await act(async () => d.resolve());
    expect(result.current.starting).toBe(false);
  });

  it('a handler that returns nothing ends the starting state at once', async () => {
    const { result } = renderHook(() => useStarting(() => undefined));
    await act(async () => result.current.start());
    expect(result.current.starting).toBe(false);
  });
});
