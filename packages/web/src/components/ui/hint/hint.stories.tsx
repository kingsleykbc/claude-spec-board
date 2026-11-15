import type { Meta, StoryObj } from '@storybook/react-vite';
import { LuEllipsis, LuSettings } from 'react-icons/lu';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Hint } from './hint';
import { ResponsiveMenu, ResponsiveMenuItem } from '@/components/ui/responsive-menu/responsive-menu';

const meta = {
  title: 'UI/Hint',
  component: Hint,
  args: {
    label: 'Settings',
    children: (
      <button type="button" className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border border-line bg-transparent p-0 text-fg hover:bg-panel">
        <LuSettings className="block size-4" aria-hidden="true" />
      </button>
    ),
  },
  decorators: [(Story) => <div className="p-10">{Story()}</div>],
} satisfies Meta<typeof Hint>;
export default meta;
type Story = StoryObj<typeof meta>;

/** An icon-only button: the label shows on hover or focus, and names the button. */
export const Default: Story = {};

/** The trigger already has its own accessible name; the hint keeps it. */
export const OwnLabel: Story = {
  args: {
    label: 'Open settings (,)',
    side: 'bottom',
    children: (
      <button type="button" aria-label="Settings" className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border border-line bg-transparent p-0 text-fg hover:bg-panel">
        <LuSettings className="block size-4" aria-hidden="true" />
      </button>
    ),
  },
};

/** A Hint around a menu trigger: the tooltip names the icon button, and a click still opens the menu. */
export const AroundMenuTrigger: Story = {
  args: { label: 'Card actions', children: <span /> },
  render: () => <MenuWithHint onArchive={fn()} />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Card actions' }));
    expect(await within(document.body).findByRole('menuitem', { name: 'Archive' })).toBeTruthy();
  },
};

function MenuWithHint({ onArchive }: { onArchive: () => void }) {
  return (
    <ResponsiveMenu
      title="Card actions"
      trigger={
        <Hint label="Card actions">
          <button type="button" className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border border-line bg-transparent p-0 text-fg hover:bg-panel">
            <LuEllipsis className="block size-4" aria-hidden="true" />
          </button>
        </Hint>
      }
    >
      <ResponsiveMenuItem onSelect={onArchive}>Archive</ResponsiveMenuItem>
    </ResponsiveMenu>
  );
}
