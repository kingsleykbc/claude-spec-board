import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { composeStories } from '@storybook/react-vite';
import * as stories from './conflict-dialog.stories';

const { Spec, Document } = composeStories(stories);

afterEach(cleanup);

describe('ConflictDialog', () => {
  it('shows the prototype copy and wires the three actions; scrim click keeps editing', () => {
    const h = { onKeepEditing: vi.fn(), onReloadKeepCopy: vi.fn(), onReload: vi.fn() };
    render(<Spec {...h} />);
    const dlg = screen.getByRole('alertdialog', { name: 'This spec changed outside the board' });
    expect(
      within(dlg).getByText(
        'Claude updated the file while you were editing. Reload to see the latest version? You can keep your unsaved text as a separate copy.',
      ),
    ).toBeTruthy();
    expect(within(dlg).getByText('specs/T-105/spec.md')).toBeTruthy();
    fireEvent.click(within(dlg).getByRole('button', { name: 'Keep editing' }));
    fireEvent.click(within(dlg).getByRole('button', { name: 'Reload & keep my copy' }));
    fireEvent.click(within(dlg).getByRole('button', { name: 'Reload' }));
    expect(h.onKeepEditing).toHaveBeenCalledTimes(1);
    expect(h.onReloadKeepCopy).toHaveBeenCalledTimes(1);
    expect(h.onReload).toHaveBeenCalledTimes(1);
    fireEvent.mouseDown(within(dlg).getByRole('button', { name: 'Reload' }));
    fireEvent.click(dlg.parentElement!);
    expect(h.onKeepEditing).toHaveBeenCalledTimes(1);
    fireEvent.mouseDown(dlg.parentElement!);
    fireEvent.click(dlg.parentElement!);
    expect(h.onKeepEditing).toHaveBeenCalledTimes(2);
  });

  it('takes an optional title', () => {
    render(<Document />);
    expect(screen.getByRole('alertdialog', { name: 'This document changed outside the board' })).toBeTruthy();
    expect(screen.getByText('CLAUDE.md')).toBeTruthy();
  });
});
