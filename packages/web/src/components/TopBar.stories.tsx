import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { TopBar } from './TopBar';
import { ConnectionBanner } from './ConnectionBanner';
import type { Conn } from '../api/live';

const projects = [
  { id: 'p1', name: 'Recipe Box', root: '~/code/recipe-box', progress: { done: 3, total: 9 } },
  { id: 'p2', name: 'Spec Board', root: '~/code/claude-spec-board', progress: { done: 0, total: 0 } },
];

/** The top bar with the connection banner under it, as the app stacks them. */
function Bar({ conn, open = false }: { conn: Conn; open?: boolean }) {
  return (
    <div style={{ minHeight: 360 }}>
      <TopBar
        switcher={{ name: 'Recipe Box', progress: { done: 3, total: 9 }, projects, current: 'p1', open, onToggle: fn(), onPick: fn(), onOpenFolder: fn() }}
        conn={conn}
        theme="light"
        onToggleTheme={fn()}
        onOpenRefs={fn()}
        onOpenOverview={fn()}
      />
      <ConnectionBanner conn={conn} onReconnect={fn()} />
    </div>
  );
}

const meta = { title: 'Shell/TopBar', component: Bar, args: { conn: 'live' } } satisfies Meta<typeof Bar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Live: Story = {
  args: { conn: 'live' },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    expect(c.getByText('SPEC-BOARD')).toBeTruthy();
    expect(c.getByTestId('conn').textContent).toBe('Live');
    expect(c.queryByText('Reconnect')).toBeNull();
  },
};

export const Reconnecting: Story = {
  args: { conn: 'reconnecting' },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    expect(c.getByTestId('conn').textContent).toBe('Reconnecting…');
    expect(c.getByRole('status').textContent).toContain('Edits will save once the connection is back.');
  },
};

export const Disconnected: Story = {
  args: { conn: 'disconnected' },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    expect(c.getByTestId('conn').textContent).toBe('Disconnected');
    expect(c.getByRole('button', { name: 'Reconnect' })).toBeTruthy();
  },
};

export const SwitcherOpen: Story = {
  args: { conn: 'live', open: true },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    expect(c.getAllByRole('menuitemradio')).toHaveLength(2);
    expect(c.getByText('No specs yet')).toBeTruthy();
    expect(c.getByText('Open another project folder…')).toBeTruthy();
  },
};
