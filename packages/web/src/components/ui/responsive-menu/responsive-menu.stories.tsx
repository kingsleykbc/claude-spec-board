import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import {
  ResponsiveMenu,
  ResponsiveMenuItem,
  ResponsiveMenuLabel,
  ResponsiveMenuRadioGroup,
  ResponsiveMenuRadioItem,
  ResponsiveMenuSeparator,
  ResponsiveMenuSub,
} from './responsive-menu';
import { Modal } from '@/components/ui/modal/modal';
import { narrow } from '@/stories/narrow-screen';

const triggerClass = 'cursor-pointer rounded-lg border border-line bg-card px-3 py-1.5 text-fg';

function Example({ onSettings, onSync, align }: { onSettings: () => void; onSync: () => void; align?: 'start' | 'center' | 'end' }) {
  const [theme, setTheme] = useState('system');
  const [archived, setArchived] = useState(true);
  return (
    <div className="p-6">
      <ResponsiveMenu
        title="Board menu"
        align={align}
        trigger={
          <button type="button" className={triggerClass}>
            Menu
          </button>
        }
      >
        <ResponsiveMenuLabel>Board</ResponsiveMenuLabel>
        <ResponsiveMenuItem onSelect={onSettings}>Settings</ResponsiveMenuItem>
        <ResponsiveMenuItem onSelect={onSync}>Sync with Claude</ResponsiveMenuItem>
        <ResponsiveMenuItem onSelect={() => undefined} disabled>
          Export (soon)
        </ResponsiveMenuItem>
        <ResponsiveMenuItem checked={archived} onSelect={() => setArchived((a) => !a)}>
          Show archived
        </ResponsiveMenuItem>
        <ResponsiveMenuSeparator />
        <ResponsiveMenuSub label="Theme">
          <ResponsiveMenuRadioGroup value={theme} onValueChange={setTheme}>
            {['light', 'dark', 'system'].map((t) => (
              <ResponsiveMenuRadioItem key={t} value={t}>
                {t[0]!.toUpperCase() + t.slice(1)}
              </ResponsiveMenuRadioItem>
            ))}
          </ResponsiveMenuRadioGroup>
        </ResponsiveMenuSub>
      </ResponsiveMenu>
    </div>
  );
}

const meta = {
  title: 'UI/ResponsiveMenu',
  component: Example,
  args: { onSettings: fn(), onSync: fn() },
} satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Wide screens: a dropdown, with Theme as a submenu of radio items. */
export const Wide: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const body = within(document.body);
    // Pick Dark with the pointer through the flyout; the whole menu closes and Dark is now checked.
    await userEvent.click(c.getByRole('button', { name: 'Menu' }));
    await userEvent.click(await body.findByRole('menuitem', { name: 'Theme' }));
    await userEvent.click(await body.findByRole('menuitemradio', { name: 'Dark' }));
    await waitFor(() => expect(body.queryByRole('menu')).toBeNull());
    await userEvent.click(c.getByRole('button', { name: 'Menu' }));
    await userEvent.click(await body.findByRole('menuitem', { name: 'Theme' }));
    expect((await body.findByRole('menuitemradio', { name: 'Dark' })).getAttribute('aria-checked')).toBe('true');
    await userEvent.keyboard('{Escape}');
  },
};


/** Narrow screens: a bottom drawer titled "Board menu"; Theme shows as a labelled group. */
export const Narrow: Story = {
  decorators: [narrow],
};

/** A menu item that opens a modal, as the logo menu's Settings does. Focus must end up in the modal. */
function OpensModal() {
  const [open, setOpen] = useState(false);
  return (
    <div className="p-6">
      <ResponsiveMenu
        title="Board menu"
        trigger={
          <button type="button" className={triggerClass}>
            Menu
          </button>
        }
      >
        <ResponsiveMenuItem onSelect={() => setOpen(true)}>Settings</ResponsiveMenuItem>
      </ResponsiveMenu>
      {open && (
        <Modal label="Settings" width="min(520px, 100%)" height="auto" onClose={() => setOpen(false)}>
          <div className="p-7">
            <button type="button" className={triggerClass}>
              Inside
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

const focusStaysInModal: Story['play'] = async ({ canvasElement }) => {
  const c = within(canvasElement);
  await userEvent.click(c.getByRole('button', { name: 'Menu' }));
  await userEvent.click(await within(document.body).findByRole('menuitem', { name: 'Settings' }));
  const dlg = await c.findByRole('dialog', { name: 'Settings' });
  // The menu (and the drawer's slide-out) finishes closing after the modal has taken focus.
  await new Promise((r) => setTimeout(r, 800));
  await waitFor(() => expect(dlg.contains(document.activeElement)).toBe(true));
};

export const ItemOpensModal: Story = {
  render: () => <OpensModal />,
  play: focusStaysInModal,
};

export const ItemOpensModalNarrow: Story = {
  render: () => <OpensModal />,
  decorators: [narrow],
  play: focusStaysInModal,
};

/** Items that are links: one opens in a new tab, one is the page you are on. */
function WithLinks({ onSelect }: { onSelect: () => void }) {
  return (
    <div className="p-6">
      <ResponsiveMenu
        title="Board menu"
        trigger={
          <button type="button" className={triggerClass}>
            Menu
          </button>
        }
      >
        <ResponsiveMenuItem href="/docs" newTab onSelect={onSelect}>
          Documentation
        </ResponsiveMenuItem>
        <ResponsiveMenuItem href="/" current>
          Board
        </ResponsiveMenuItem>
      </ResponsiveMenu>
    </div>
  );
}

export const Links: StoryObj<typeof WithLinks> = {
  render: (args) => <WithLinks {...args} />,
  args: { onSelect: fn() },
};

export const LinksNarrow: StoryObj<typeof WithLinks> = {
  render: (args) => <WithLinks {...args} />,
  args: { onSelect: fn() },
  decorators: [narrow],
};

/** Checkable items that leave the menu open, for ticking several in a row (the filter menus). */
function KeepOpenExample() {
  const [picked, setPicked] = useState<string[]>([]);
  const flip = (x: string) => setPicked((p) => (p.includes(x) ? p.filter((y) => y !== x) : [...p, x]));
  return (
    <div className="p-6">
      <ResponsiveMenu
        title="Fruit"
        trigger={
          <button type="button" className={triggerClass}>
            Fruit
          </button>
        }
      >
        {['Apple', 'Pear'].map((x) => (
          <ResponsiveMenuItem key={x} keepOpen checked={picked.includes(x)} onSelect={() => flip(x)}>
            {x}
          </ResponsiveMenuItem>
        ))}
      </ResponsiveMenu>
    </div>
  );
}

export const KeepOpen: StoryObj<typeof KeepOpenExample> = {
  render: () => <KeepOpenExample />,
};

export const KeepOpenNarrow: StoryObj<typeof KeepOpenExample> = {
  render: () => <KeepOpenExample />,
  decorators: [narrow],
};
