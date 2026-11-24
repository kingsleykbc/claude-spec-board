import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { composeStories } from '@storybook/react-vite';
import * as stories from './detail-header.stories';

const { Default, WithSync, Simple, Draft, NotConnectedDraft, Narrow, WithArchive } = composeStories(stories);

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

  it('Sync says Starting…, disabled, until its start settles', async () => {
    let settle!: () => void;
    const onSync = vi.fn(() => new Promise<void>((r) => (settle = r)));
    render(<WithSync onSync={onSync} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sync' }));
    const btn = screen.getByRole('button', { name: 'Starting…' });
    expect(btn).toHaveProperty('disabled', true);
    fireEvent.click(btn);
    expect(onSync).toHaveBeenCalledOnce();
    await act(async () => settle());
    expect(screen.getByRole('button', { name: 'Sync' })).toHaveProperty('disabled', false);
  });

  it('Have Claude write this up says Starting… too', () => {
    render(<Draft onWriteUp={() => new Promise(() => undefined)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Have Claude write this up' }));
    expect(screen.getByRole('button', { name: 'Starting…' })).toHaveProperty('disabled', true);
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

  it('the close button is pinned to the top right (absolute), and the first row keeps clear of it', () => {
    render(<Default />);
    const close = screen.getByRole('button', { name: 'Close' });
    expect(close.className).toContain('absolute');
    expect(screen.getByText('T-103').parentElement!.className).toContain('pr-[44px]');
  });

  it('the actions are a second, wrapping row under the identity row', () => {
    render(<Narrow />);
    const actions = screen.getByTestId('detail-actions');
    expect(actions.className).toContain('flex-wrap');
    expect(within(actions).getByRole('button', { name: 'Run with Claude' })).toBeTruthy();
    expect(within(actions).getByRole('button', { name: 'Sync' })).toBeTruthy();
    // Status and the ID are in the first row, not here.
    expect(within(actions).queryByText('T-103')).toBeNull();
  });

  it('a draft shows the Draft badge and Have Claude write this up, which calls onWriteUp', async () => {
    const user = userEvent.setup();
    const onWriteUp = vi.fn();
    render(<Draft onWriteUp={onWriteUp} />);
    expect(screen.getByText('Draft')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Have Claude write this up' }));
    expect(onWriteUp).toHaveBeenCalledOnce();
  });

  it('a spec that is not a draft has no write-up button', () => {
    render(<Default />);
    expect(screen.queryByRole('button', { name: 'Have Claude write this up' })).toBeNull();
  });

  it('not connected: the write-up button is greyed, not disabled, and shows the command to paste', async () => {
    const user = userEvent.setup();
    const onWriteUp = vi.fn();
    render(<NotConnectedDraft onWriteUp={onWriteUp} />);
    const btn = screen.getByRole('button', { name: 'Have Claude write this up' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    expect(btn.className).not.toContain('bg-accent');
    expect(btn.getAttribute('aria-description')).toBe('Claude isn’t connected');
    await user.click(btn);
    const pop = await screen.findByRole('dialog', { name: "Claude isn’t connected" });
    expect(pop.textContent).toContain('/create-spec T-103');
    expect(onWriteUp).not.toHaveBeenCalled();
  });

  it('Archive is in the ⋯ menu for a spec in any column', async () => {
    const user = userEvent.setup();
    const onArchive = vi.fn();
    render(<WithArchive onArchive={onArchive} />);
    await user.click(screen.getByRole('button', { name: 'Card actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Archive' }));
    expect(onArchive).toHaveBeenCalledOnce();
  });

  it('an archived spec offers Unarchive', async () => {
    const user = userEvent.setup();
    const onUnarchive = vi.fn();
    render(<WithArchive archived onUnarchive={onUnarchive} />);
    await user.click(screen.getByRole('button', { name: 'Card actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Unarchive' }));
    expect(onUnarchive).toHaveBeenCalledOnce();
  });
});
