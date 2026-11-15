import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { ConflictDialog } from './conflict-dialog';

const meta = {
  title: 'Modals/Conflict',
  component: ConflictDialog,
  args: { path: 'specs/T-105/spec.md', onKeepEditing: fn(), onReloadKeepCopy: fn(), onReload: fn() },
} satisfies Meta<typeof ConflictDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A spec save got a 409: keep editing, reload and keep a copy, or reload. */
export const Spec: Story = {
  play: async () => {
    const dlg = within(document.body).getByRole('alertdialog', { name: 'This spec changed outside the board' });
    expect(within(dlg).getByRole('button', { name: 'Reload' })).toBeTruthy();
  },
};

/** The references wording. */
export const Document: Story = {
  args: { title: 'This document changed outside the board', path: 'CLAUDE.md' },
  play: async () => {
    expect(within(document.body).getByRole('alertdialog', { name: 'This document changed outside the board' })).toBeTruthy();
  },
};
