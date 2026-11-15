import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { composeStories } from '@storybook/react-vite';
import * as stories from './detail-header.stories';

const { Default, WithSync, Simple } = composeStories(stories);

afterEach(cleanup);

describe('DetailHeader', () => {
  it('shows the ID, path, title, urgency and categories; × has a Close tooltip and closes', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Default onClose={onClose} />);
    expect(screen.getByText('T-103')).toBeTruthy();
    expect(screen.getByText('.specboard/specs/T-103-search-and-filters/spec.md')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Search & filters' })).toBeTruthy();
    expect(screen.getByRole('radiogroup', { name: 'Urgency' })).toBeTruthy();
    expect(screen.getByText('Backend')).toBeTruthy();
    const close = screen.getByRole('button', { name: 'Close' });
    await user.hover(close);
    await waitFor(() => expect(screen.getByRole('tooltip').textContent).toBe('Close'));
    await user.click(close);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('the help link next to Run has a tooltip', async () => {
    const user = userEvent.setup();
    render(<Default />);
    await user.hover(screen.getByRole('link', { name: 'Chat or background: which to use' }));
    await waitFor(() => expect(screen.getByRole('tooltip').textContent).toBe('Chat or background: which to use'));
  });

  it('Sync and the waiting proposal call their handlers', () => {
    const onSync = vi.fn();
    const onSyncWaiting = vi.fn();
    render(<WithSync onSync={onSync} onSyncWaiting={onSyncWaiting} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sync' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sync proposal waiting' }));
    expect(onSync).toHaveBeenCalledOnce();
    expect(onSyncWaiting).toHaveBeenCalledOnce();
  });

  it('Sync waits while a run is active', () => {
    render(<WithSync runState="running" />);
    expect((screen.getByRole('button', { name: 'Sync' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('Simple mode: urgency, categories and dependencies sit in a ⋯ More details popover', async () => {
    const user = userEvent.setup();
    const onDetails = vi.fn();
    const { rerender } = render(<Simple onDetails={onDetails} />);
    expect(screen.queryByRole('radiogroup', { name: 'Urgency' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'More details' }));
    expect(onDetails).toHaveBeenCalledWith(true);
    rerender(<Simple onDetails={onDetails} detailsOpen />);
    const pop = within(await screen.findByRole('dialog', { name: 'More details' }));
    expect(pop.getByRole('radiogroup', { name: 'Urgency' })).toBeTruthy();
    expect(pop.getByText('Backend')).toBeTruthy();
    expect(pop.getByText('Dependencies go here.')).toBeTruthy();
  });
});
