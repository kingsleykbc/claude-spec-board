import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Modal } from './modal';
import { ConflictDialog } from '@/components/ConflictDialog';
import { useDiscardGuard } from '@/lib/use-discard-guard';

const meta = {
  title: 'UI/Modal',
  component: Modal,
  args: { label: 'Example', width: 'min(900px, 100%)', onClose: fn(), children: null },
} satisfies Meta<typeof Modal>;
export default meta;
type Story = StoryObj<typeof meta>;

const btn = 'rounded-lg border border-line2 bg-card px-3.5 py-2 text-fg';

export const Empty: Story = {
  args: {
    children: (
      <div className="p-7">
        <button type="button" className={btn}>
          Inside
        </button>
      </div>
    ),
  },
  play: async ({ canvasElement, args }) => {
    const dlg = within(canvasElement).getByRole('dialog', { name: 'Example' });
    await userEvent.click(within(dlg).getByRole('button', { name: 'Inside' }));
    expect(args.onClose).not.toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    expect(args.onClose).toHaveBeenCalledTimes(1);
  },
};

export const WithConflictDialog: Story = {
  args: {
    children: <ConflictDialog path=".specboard/specs/T-105-shopping-list-export/spec.md" onKeepEditing={fn()} onReloadKeepCopy={fn()} onReload={fn()} />,
  },
  play: async ({ args }) => {
    const body = within(document.body);
    expect(body.getByRole('alertdialog', { name: 'This spec changed outside the board' })).toBeTruthy();
    await userEvent.keyboard('{Escape}');
    // Esc goes to the dialog first, not the modal.
    expect(args.onClose).not.toHaveBeenCalled();
  },
};

/** An opener button, a modal with two buttons, and a conflict dialog the second button opens. */
function Harness({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState(false);
  return (
    <div className="p-6">
      <button type="button" className={btn} onClick={() => setOpen(true)}>
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
          <div className="flex gap-2 p-7">
            <button type="button" className={btn}>
              First
            </button>
            <button type="button" className={btn} onClick={() => setDialog(true)}>
              Last
            </button>
          </div>
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
    </div>
  );
}

/** Opening, closing and focus return, as a page does it. */
export const WithOpener: Story = {
  render: (args) => <Harness onClose={args.onClose} />,
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole('button', { name: 'Opener' }));
    expect(c.getByRole('dialog', { name: 'Card' })).toBeTruthy();
    await userEvent.keyboard('{Escape}');
    expect(args.onClose).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(c.getByRole('button', { name: 'Opener' }));
  },
};

/** A modal with unsaved work: leaving asks "Discard your changes?" first. */
function Dirty({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(true);
  const close = () => {
    onClose();
    setOpen(false);
  };
  const { requestClose, dialog } = useDiscardGuard({
    editing: false,
    dirty: false,
    otherDirty: true,
    what: 'this spec',
    onLeave: () => undefined,
    onClose: close,
  });
  if (!open) return <p className="m-0 p-6">Closed</p>;
  return (
    <Modal label="New spec" width="min(600px, 100%)" height="auto" onClose={requestClose}>
      <div className="p-7">
        <input aria-label="Title" defaultValue="Half-written title" className="rounded-lg border border-line2 px-2.5 py-1.5" />
      </div>
      {dialog}
    </Modal>
  );
}

export const DirtyGuard: Story = {
  args: { label: 'New spec' },
  render: (args) => <Dirty onClose={args.onClose} />,
  play: async ({ canvasElement, args }) => {
    expect(within(canvasElement).getByRole('dialog', { name: 'New spec' })).toBeTruthy();
    await userEvent.keyboard('{Escape}');
    expect(await within(document.body).findByRole('alertdialog', { name: 'Discard your changes?' })).toBeTruthy();
    expect(args.onClose).not.toHaveBeenCalled();
  },
};
