import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { Modal } from './Modal';
import { ConflictDialog } from './ConflictDialog';

afterEach(cleanup);

function Harness({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Opener
      </button>
      {open && (
        <Modal
          label="Card"
          width="min(900px, 100%)"
          onClose={() => {
            onClose();
            setOpen(false);
          }}
        >
          <button type="button">First</button>
          <button type="button" onClick={() => setDialog(true)}>
            Last
          </button>
          {dialog && (
            <ConflictDialog
              path="specs/x.md"
              onKeepEditing={() => setDialog(false)}
              onReloadKeepCopy={() => setDialog(false)}
              onReload={() => setDialog(false)}
            />
          )}
        </Modal>
      )}
    </>
  );
}

describe('Modal', () => {
  it('is a labelled modal dialog; scrim click closes it, a click inside does not', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.click(screen.getByText('Opener'));
    const dlg = screen.getByRole('dialog', { name: 'Card' });
    expect(dlg.getAttribute('aria-modal')).toBe('true');
    fireEvent.click(screen.getByText('First'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(dlg.parentElement!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('traps focus with Tab and returns focus to the opener on close', () => {
    render(<Harness onClose={() => undefined} />);
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
    render(<Harness onClose={onClose} />);
    fireEvent.click(screen.getByText('Opener'));
    fireEvent.click(screen.getByText('Last'));
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
