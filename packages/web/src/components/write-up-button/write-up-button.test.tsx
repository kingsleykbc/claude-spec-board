import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { composeStories } from '@storybook/react-vite';
import * as stories from './write-up-button.stories';

const { Ready, NotConnected } = composeStories(stories);

afterEach(cleanup);

describe('WriteUpButton', () => {
  it('calls onWriteUp', () => {
    const onWriteUp = vi.fn();
    render(<Ready onWriteUp={onWriteUp} />);
    fireEvent.click(screen.getByRole('button', { name: 'Have Claude write this up' }));
    expect(onWriteUp).toHaveBeenCalledOnce();
  });

  it('shows a spinner and Starting…, disabled, until the start settles, then comes back', async () => {
    let settle!: (ok: boolean) => void;
    const onWriteUp = vi.fn(() => new Promise<boolean>((r) => (settle = r)));
    render(<Ready onWriteUp={onWriteUp} />);
    fireEvent.click(screen.getByRole('button', { name: 'Have Claude write this up' }));
    const btn = screen.getByRole('button', { name: 'Starting…' });
    expect(btn).toHaveProperty('disabled', true);
    expect(within(btn).getByTestId('spinner')).toBeTruthy();
    fireEvent.click(btn);
    expect(onWriteUp).toHaveBeenCalledOnce();
    await act(async () => settle(false));
    expect(screen.getByRole('button', { name: 'Have Claude write this up' })).toHaveProperty('disabled', false);
  });

  it('not connected: starts nothing', () => {
    const onWriteUp = vi.fn();
    render(<NotConnected onWriteUp={onWriteUp} />);
    fireEvent.click(screen.getByRole('button', { name: 'Have Claude write this up' }));
    expect(onWriteUp).not.toHaveBeenCalled();
  });
});
