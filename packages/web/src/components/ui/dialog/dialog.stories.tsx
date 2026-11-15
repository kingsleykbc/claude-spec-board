import type { Meta, StoryObj } from '@storybook/react-vite';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './dialog';

const meta = { title: 'UI/Dialog', component: Dialog } satisfies Meta<typeof Dialog>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A modal dialog with a title, a description and a close button. */
export const Default: Story = {
  render: () => (
    <div className="p-6">
      <Dialog>
        <DialogTrigger className="rounded-md border border-line bg-card px-3 py-1.5 text-fg">Open dialog</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete spec</DialogTitle>
            <DialogDescription>The spec moves to the archive. You can bring it back later.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose className="rounded-md border border-line px-3 py-1.5">Cancel</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  ),
};
