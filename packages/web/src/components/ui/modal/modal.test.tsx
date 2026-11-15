import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { composeStories } from '@storybook/react-vite';
import * as stories from './modal.stories';

const { Empty, WithOpener, DirtyGuard } = composeStories(stories);

afterEach(cleanup);

describe('Modal', () => {
  it('is a labelled modal dialog; scrim click closes it, a click inside does not', () => {
    const onClose = vi.fn();
    render(<WithOpener onClose={onClose} />);
    fireEvent.click(screen.getByText('Opener'));
    const dlg = screen.getByRole('dialog', { name: 'Card' });
    expect(dlg.getAttribute('aria-modal')).toBe('true');
    fireEvent.click(screen.getByText('First'));
    expect(onClose).not.toHaveBeenCalled();
    const scrim = dlg.parentElement!;
    // A press that starts inside (e.g. selecting text) and ends on the scrim does not close.
    fireEvent.mouseDown(screen.getByText('First'));
    fireEvent.click(scrim);
    expect(onClose).not.toHaveBeenCalled();
    // A click without a press on the scrim (synthetic) does not close either.
    fireEvent.click(scrim);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.mouseDown(scrim);
    fireEvent.click(scrim);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('traps focus with Tab and returns focus to the opener on close', () => {
    render(<WithOpener onClose={vi.fn()} />);
    const opener = screen.getByText('Opener');
    opener.focus();
    fireEvent.click(opener);
    const dlg = screen.getByRole('dialog', { name: 'Card' });
    expect(dlg.contains(document.activeElement)).toBe(true);
    screen.getByText('Last').focus();
    fireEvent.keyDown(document.activeElement!, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByText('First'));
    fireEvent.keyDown(document.activeElement!, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(screen.getByText('Last'));
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('Esc closes a dialog on top of the modal before the modal', () => {
    const onClose = vi.fn();
    render(<WithOpener onClose={onClose} />);
    fireEvent.click(screen.getByText('Opener'));
    fireEvent.click(screen.getByText('Last'));
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape closes it, a click inside does not', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Empty onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Inside' }));
    expect(onClose).not.toHaveBeenCalled();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('with a dirty discard guard, Escape asks first; Esc on the question stays, Discard closes', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<DirtyGuard onClose={onClose} />);
    expect(screen.getByRole('dialog', { name: 'New spec' })).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('alertdialog', { name: 'Discard your changes?' })).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    // Esc on the question keeps editing.
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByRole('dialog', { name: 'New spec' })).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
