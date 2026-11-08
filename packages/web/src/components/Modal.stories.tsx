import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Modal } from './Modal';
import { ConflictDialog } from './ConflictDialog';

const meta = {
  title: 'Shell/Modal',
  component: Modal,
  args: { label: 'Example', width: 'min(900px, 100%)', onClose: fn(), children: null },
} satisfies Meta<typeof Modal>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    children: (
      <div style={{ padding: 28 }}>
        <button type="button">Inside</button>
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
