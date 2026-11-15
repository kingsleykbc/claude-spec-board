import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { composeStories } from '@storybook/react-vite';
import * as stories from './confirm-dialog.stories';

const { Default, WithPath } = composeStories(stories);

afterEach(cleanup);

describe('ConfirmDialog', () => {
  it('is a labelled alert dialog rendered into the body, with its body text and actions', () => {
    const remove = vi.fn();
    render(
      <Default
        actions={[
          { label: 'Cancel', onClick: vi.fn() },
          { label: 'Remove', onClick: remove, kind: 'danger' },
        ]}
      />,
    );
    const dlg = screen.getByRole('alertdialog', { name: 'Remove CLAUDE.md from references?' });
    expect(dlg.getAttribute('aria-modal')).toBe('true');
    expect(dlg.parentElement!.parentElement).toBe(document.body);
    expect(within(dlg).getByText(/This removes the link only/)).toBeTruthy();
    expect(within(dlg).getByRole('button', { name: 'Remove' }).dataset.kind).toBe('danger');
    fireEvent.click(within(dlg).getByRole('button', { name: 'Remove' }));
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('focuses the first action, keeps Tab inside, and Escape dismisses', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<Default onDismiss={onDismiss} />);
    const dlg = screen.getByRole('alertdialog');
    expect(document.activeElement).toBe(within(dlg).getByRole('button', { name: 'Cancel' }));
    fireEvent.keyDown(document.activeElement!, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(within(dlg).getByRole('button', { name: 'Remove' }));
    await user.keyboard('{Escape}');
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('dismisses only on a press that starts and ends on the scrim', () => {
    const onDismiss = vi.fn();
    render(<Default onDismiss={onDismiss} />);
    const dlg = screen.getByRole('alertdialog');
    fireEvent.mouseDown(within(dlg).getByRole('button', { name: 'Cancel' }));
    fireEvent.click(dlg.parentElement!);
    expect(onDismiss).not.toHaveBeenCalled();
    fireEvent.mouseDown(dlg.parentElement!);
    fireEvent.click(dlg.parentElement!);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('shows the path in a mono box and marks the primary action', () => {
    render(<WithPath />);
    const dlg = screen.getByRole('alertdialog', { name: 'This spec changed outside the board' });
    expect(within(dlg).getByText('.specboard/specs/T-105-shopping-list-export/spec.md')).toBeTruthy();
    expect(within(dlg).getByRole('button', { name: 'Reload' }).dataset.kind).toBe('primary');
  });
});
