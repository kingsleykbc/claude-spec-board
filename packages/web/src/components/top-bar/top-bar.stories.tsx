import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { TopBar } from './top-bar';
import { ConnectionBanner } from '@/components/connection-banner/connection-banner';
import type { SwitcherProject } from '@/components/project-switcher/project-switcher';
import type { Conn } from '@/api/live';
import type { ManualReason } from '@/state/runUi';
import { applyThemeChoice, type ThemeChoice } from '@/lib/theme';
import { narrow } from '@/stories/narrow-screen';

const projects: SwitcherProject[] = [
  { id: 'p1', name: 'Recipe Box', root: '~/code/recipe-box', progress: { done: 3, total: 9 }, available: true },
  { id: 'p2', name: 'Spec Board', root: '~/code/claude-spec-board', progress: { done: 0, total: 0 }, available: false },
];

interface BarProps {
  conn: Conn;
  page?: 'board' | 'docs';
  /** Starting values; the bar keeps them in state as the app does. */
  simple?: boolean;
  theme?: ThemeChoice;
  /** Leave the project switcher out (the docs page before the projects load). */
  noSwitcher?: boolean;
  manual?: ManualReason | null;
  syncWaiting?: boolean;
  onSimple: (on: boolean) => void;
  onTheme: (c: ThemeChoice) => void;
  onOpenRefs: () => void;
  onOpenOverview: () => void;
  onOpenLogs: () => void;
  onTour: () => void;
  onSync: () => void;
  onSyncWaiting: () => void;
  onSettings: () => void;
  onPick: (id: string) => void;
  onOpenFolder: () => void;
}

/** The top bar with the connection banner under it, as the app stacks them. Simple mode and the theme live in state here, as in the app. */
function Bar({ conn, page = 'board', simple: simple0 = false, theme: theme0 = 'light', noSwitcher, manual = null, syncWaiting = false, ...on }: BarProps) {
  const [simple, setSimple] = useState(simple0);
  const [theme, setTheme] = useState<ThemeChoice>(theme0);
  const board = page === 'board';
  return (
    <div className="min-h-[360px]">
      <TopBar
        page={page}
        {...(noSwitcher
          ? {}
          : {
              switcher: {
                name: 'Recipe Box',
                progress: { done: 3, total: 9 },
                projects,
                current: 'p1',
                onPick: on.onPick,
                onOpenFolder: on.onOpenFolder,
              },
            })}
        themeChoice={theme}
        onThemeChoice={(c) => {
          on.onTheme(c);
          applyThemeChoice(c, true);
          setTheme(c);
        }}
        {...(board
          ? {
              conn,
              simple,
              onSimple: (v: boolean) => {
                on.onSimple(v);
                setSimple(v);
              },
              manual,
              syncWaiting,
              onOpenRefs: on.onOpenRefs,
              onOpenOverview: on.onOpenOverview,
              onOpenLogs: on.onOpenLogs,
              onTour: on.onTour,
              onSync: on.onSync,
              onSyncWaiting: on.onSyncWaiting,
              onSettings: on.onSettings,
            }
          : {})}
      />
      {board && <ConnectionBanner conn={conn} onReconnect={() => undefined} />}
    </div>
  );
}

const meta = {
  title: 'Shell/TopBar',
  component: Bar,
  args: {
    conn: 'live',
    onSimple: fn(),
    onTheme: fn(),
    onOpenRefs: fn(),
    onOpenOverview: fn(),
    onOpenLogs: fn(),
    onTour: fn(),
    onSync: fn(),
    onSyncWaiting: fn(),
    onSettings: fn(),
    onPick: fn(),
    onOpenFolder: fn(),
  },
} satisfies Meta<typeof Bar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Live: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    expect(c.getByRole('button', { name: 'Spec Board' })).toBeTruthy();
    expect(c.getByTestId('conn').title).toBe('Connected. Watching specs/ for changes.');
    expect(c.getByTestId('conn').textContent).toBe('');
    expect(c.queryByText('Reconnect')).toBeNull();
    // References, Overview and Logs carry an icon beside their text, and Logs is the last button.
    for (const n of ['References', 'Overview', 'Logs']) expect(c.getByRole('button', { name: n }).querySelector('svg')).toBeTruthy();
    expect(c.getAllByRole('button').at(-1)!.textContent).toBe('Logs');
  },
};

export const Reconnecting: Story = {
  args: { conn: 'reconnecting' },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    expect(c.getByTestId('conn').title).toBe('Not connected to the local server');
    expect(c.getByRole('status').textContent).toContain('Edits will save once the connection is back.');
  },
};

export const Disconnected: Story = {
  args: { conn: 'disconnected' },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    expect(c.getByTestId('conn').getAttribute('aria-label')).toBe('Disconnected');
    expect(c.getByRole('button', { name: 'Reconnect' })).toBeTruthy();
  },
};

export const SwitcherOpen: Story = {
  play: async ({ canvasElement }) => {
    const body = within(document.body);
    await userEvent.click(within(canvasElement).getByRole('button', { name: /Recipe Box/ }));
    expect(await body.findAllByRole('menuitemradio')).toHaveLength(2);
    expect(body.getByText('No specs yet')).toBeTruthy();
    expect(body.getByText('Open another project folder…')).toBeTruthy();
    await userEvent.keyboard('{Escape}');
  },
};

/** The logo menu: Theme is a submenu of Light / Dark / System. */
export const LogoMenu: Story = {
  args: { syncWaiting: true },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const body = within(document.body);
    await userEvent.click(c.getByRole('button', { name: 'Spec Board' }));
    await userEvent.click(await body.findByRole('menuitem', { name: 'Theme' }));
    expect(await body.findAllByRole('menuitemradio')).toHaveLength(3);
    await userEvent.click(body.getByRole('menuitemradio', { name: 'Dark' }));
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'));
    expect(localStorage.getItem('specboard.theme')).toBe('dark');
    localStorage.removeItem('specboard.theme');
  },
};

/** Claude can't run here: the not-connected icon sits before References. */
export const NotConnected: Story = {
  args: { manual: 'not-approved' },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole('button', { name: "Claude isn't connected to the board" }));
    expect(await within(document.body).findByRole('dialog', { name: "Claude isn't connected to the board" })).toBeTruthy();
  },
};

/** Simple mode: References and Overview move into the logo menu; Logs stays last in the header. */
export const Simple: Story = {
  args: { simple: true, manual: 'not-installed' },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    expect(c.queryByRole('button', { name: 'References' })).toBeNull();
    expect(c.getAllByRole('button').at(-1)!.textContent).toBe('Logs');
    expect(c.getByRole('switch', { name: 'Simple mode' }).getAttribute('aria-checked')).toBe('true');
  },
};

/** A phone: Logs is icon-only with a tooltip; the rest is in the logo menu, shown as a drawer. */
export const Narrow: Story = {
  args: { manual: 'blocked' },
  decorators: [narrow],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    expect(c.getByRole('button', { name: 'Logs' }).textContent).toBe('');
    expect(c.queryByRole('switch', { name: 'Simple mode' })).toBeNull();
  },
};

/** On the docs page: the logo menu (with Theme), the project, and a link back to the board in place of References, Overview, Logs and the live dot. */
export const DocsPage: Story = {
  args: { page: 'docs' },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    expect(c.getByRole('link', { name: 'Open the board' }).getAttribute('href')).toBe('/?project=p1');
    expect(c.queryByRole('button', { name: 'References' })).toBeNull();
    await userEvent.click(c.getByRole('button', { name: 'Spec Board' }));
    expect(await within(document.body).findByRole('menuitem', { name: 'Board' })).toBeTruthy();
    await userEvent.keyboard('{Escape}');
  },
};
