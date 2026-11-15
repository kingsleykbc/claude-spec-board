import { useEffect, useState, type ReactNode } from 'react';
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
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

/** Pretends the window is 720px or narrower, so `useNarrow()` is true while the story is shown. */
function NarrowScreen({ children }: { children: ReactNode }) {
  const [real] = useState(() => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: /max-width:\s*720px/.test(query),
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    return original;
  });
  useEffect(() => () => void (window.matchMedia = real), [real]);
  return children;
}

const narrow: Decorator = (Story) => <NarrowScreen>{Story()}</NarrowScreen>;

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
