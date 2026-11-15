import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { recipeSpec } from '@/fixtures/recipeBox';
import { AddSpecModal } from './add-spec-modal';

const meta = {
  title: 'Modals/AddSpec',
  component: AddSpecModal,
  args: {
    pid: 'p1',
    nextId: 'T-109',
    client: { createSpec: fn(async (_pid: string, b: { title: string }) => ({ spec: { ...recipeSpec('T-107'), id: 'T-109', title: b.title } })) },
    toast: fn(),
    refresh: fn(async () => undefined),
    onWriteUp: fn(async () => undefined),
    onClose: fn(),
  },
} satisfies Meta<typeof AddSpecModal>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  play: async ({ canvasElement }) => {
    const dlg = within(canvasElement).getByRole('dialog', { name: 'New spec' });
    expect(within(dlg).getByText('T-109')).toBeTruthy();
    expect(within(dlg).getByRole('button', { name: 'Add as draft' })).toHaveProperty('disabled', true);
    expect(within(dlg).getByRole('button', { name: /Add & have Claude write it up/ })).toHaveProperty('disabled', true);
  },
};

export const Filled: Story = {
  play: async ({ canvasElement, args }) => {
    const dlg = within(canvasElement).getByRole('dialog', { name: 'New spec' });
    await userEvent.type(within(dlg).getByLabelText('Title'), 'Nutrition info per serving');
    await userEvent.type(within(dlg).getByLabelText('Description'), 'Show calories and macros for one serving.');
    const write = within(dlg).getByRole('button', { name: /Add & have Claude write it up/ });
    expect(write).toHaveProperty('disabled', false);
    await userEvent.click(write);
    await waitFor(() => expect(args.onWriteUp).toHaveBeenCalled());
    expect(args.client!.createSpec).toHaveBeenCalledWith('p1', {
      title: 'Nutrition info per serving',
      description: 'Show calories and macros for one serving.',
      draft: true,
    });
  },
};
