import { useEffect, useState, type ReactNode } from 'react';
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { ResponsiveMenu, ResponsiveMenuItem, ResponsiveMenuLabel, ResponsiveMenuSeparator, ResponsiveMenuSub } from './responsive-menu';

function Example({ onSettings, onSync, align }: { onSettings: () => void; onSync: () => void; align?: 'start' | 'center' | 'end' }) {
  const [theme, setTheme] = useState('system');
  return (
    <div className="p-6">
      <ResponsiveMenu
        title="Board menu"
        align={align}
        trigger={
          <button type="button" className="cursor-pointer rounded-lg border border-line bg-card px-3 py-1.5 text-fg">
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
        <ResponsiveMenuSeparator />
        <ResponsiveMenuSub label="Theme">
          {['light', 'dark', 'system'].map((t) => (
            <ResponsiveMenuItem key={t} checked={theme === t} onSelect={() => setTheme(t)}>
              {t[0]!.toUpperCase() + t.slice(1)}
            </ResponsiveMenuItem>
          ))}
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

/** Wide screens: a dropdown, with Theme as a submenu. */
export const Wide: Story = {};

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
