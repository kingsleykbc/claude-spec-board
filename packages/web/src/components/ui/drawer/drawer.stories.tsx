import type { Meta, StoryObj } from '@storybook/react-vite';
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from './drawer';

const meta = { title: 'UI/Drawer', component: Drawer } satisfies Meta<typeof Drawer>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A bottom sheet, as the narrow-screen menus and filters use. */
export const Default: Story = {
  render: () => (
    <div className="p-6">
      <Drawer>
        <DrawerTrigger className="rounded-md border border-line bg-card px-3 py-1.5 text-fg">Open drawer</DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Filters</DrawerTitle>
            <DrawerDescription>Narrow the board by category and urgency.</DrawerDescription>
          </DrawerHeader>
          <DrawerFooter>
            <DrawerClose className="rounded-md border border-line px-3 py-1.5">Done</DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  ),
};
