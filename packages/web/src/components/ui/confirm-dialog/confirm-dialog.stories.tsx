import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ConfirmDialog } from './confirm-dialog';

const meta = {
  title: 'UI/ConfirmDialog',
  component: ConfirmDialog,
  args: {
    title: 'Remove CLAUDE.md from references?',
    body: 'This removes the link only. The file stays in your project and you can link it again later.',
    onDismiss: fn(),
    actions: [
      { label: 'Cancel', onClick: fn() },
      { label: 'Remove', onClick: fn(), kind: 'danger' },
    ],
  },
} satisfies Meta<typeof ConfirmDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A danger action. */
export const Default: Story = {
  play: async ({ args }) => {
    const dlg = within(document.body).getByRole('alertdialog', { name: args.title });
    // Focus starts on the first action.
    expect(document.activeElement).toBe(within(dlg).getByRole('button', { name: 'Cancel' }));
    await userEvent.keyboard('{Escape}');
    expect(args.onDismiss).toHaveBeenCalledTimes(1);
  },
};

/** A primary action and a file path under the body. */
export const WithPath: Story = {
  args: {
    title: 'This spec changed outside the board',
    body: 'Claude updated the file while you were editing.',
    path: '.specboard/specs/T-105-shopping-list-export/spec.md',
    actions: [
      { label: 'Keep editing', onClick: fn() },
      { label: 'Reload', onClick: fn(), kind: 'primary' },
    ],
  },
};
