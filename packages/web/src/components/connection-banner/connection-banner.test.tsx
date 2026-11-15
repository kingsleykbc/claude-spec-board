import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { composeStories } from '@storybook/react-vite';
import * as stories from './connection-banner.stories';

const { Live, Reconnecting, Disconnected, SpinnerAlone } = composeStories(stories);

afterEach(cleanup);

describe('ConnectionBanner', () => {
  it('is hidden while live', () => {
    render(<Live />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('reconnecting copy and a spinner, no button', () => {
    render(<Reconnecting />);
    expect(screen.getByRole('status').textContent).toBe('Reconnecting…Edits will save once the connection is back.');
    expect(screen.getByTestId('spinner')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('disconnected copy and Reconnect', () => {
    const onReconnect = vi.fn();
    render(<Disconnected onReconnect={onReconnect} />);
    expect(screen.getByRole('status').textContent).toContain('The board can’t see file changes, and edits won’t save until it’s back.');
    fireEvent.click(screen.getByRole('button', { name: 'Reconnect' }));
    expect(onReconnect).toHaveBeenCalled();
  });

  it('the spinner is hidden from assistive tech', () => {
    render(<SpinnerAlone />);
    expect(screen.getByTestId('spinner').getAttribute('aria-hidden')).toBe('true');
  });
});
