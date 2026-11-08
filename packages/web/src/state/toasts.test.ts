import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { TOAST_MS, useToasts } from './toasts';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useToasts (pinned behaviour 12)', () => {
  it('keeps at most 4, newest last', () => {
    const { result } = renderHook(() => useToasts());
    act(() => {
      for (let i = 1; i <= 5; i++) result.current.push('ok', `T${i}`);
    });
    expect(result.current.toasts.map((t) => t.text)).toEqual(['T2', 'T3', 'T4', 'T5']);
  });

  it('dismisses each after 4.5 s, and on demand', () => {
    const { result } = renderHook(() => useToasts());
    act(() => result.current.push('err', 'Couldn’t move T-105', 'The file changed. Try again.'));
    expect(result.current.toasts[0]).toMatchObject({ kind: 'err', text: 'Couldn’t move T-105', sub: 'The file changed. Try again.' });
    act(() => vi.advanceTimersByTime(1000));
    act(() => result.current.push('info', 'Second'));
    act(() => vi.advanceTimersByTime(TOAST_MS - 1000));
    expect(result.current.toasts.map((t) => t.text)).toEqual(['Second']);
    act(() => result.current.dismiss(result.current.toasts[0]!.id));
    expect(result.current.toasts).toEqual([]);
    expect(TOAST_MS).toBe(4500);
  });

  it('clears its timers on unmount', () => {
    const { result, unmount } = renderHook(() => useToasts());
    act(() => result.current.push('ok', 'x'));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
