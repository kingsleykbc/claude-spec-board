import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ProjectSwitcher, type SwitcherProject } from './project-switcher';
import type { Conn } from '@/api/live';
import { narrow } from '@/stories/narrow-screen';

const projects: SwitcherProject[] = [
  { id: 'p1', name: 'Recipe Box', root: '~/code/recipe-box', progress: { done: 3, total: 9 }, available: true },
  { id: 'p2', name: 'Empty', root: '~/code/empty', progress: { done: 0, total: 0 }, available: false },
];

/** The switcher with its open state, as the app holds it. */
function Switcher({ conn, open: open0 = false, onPick, onOpenFolder }: { conn?: Conn; open?: boolean; onPick: (id: string) => void; onOpenFolder: () => void }) {
  const [open, setOpen] = useState(open0);
  return (
    <div className="min-h-[260px] p-3">
      <ProjectSwitcher
        {...(conn ? { conn } : {})}
        name="Recipe Box"
        progress={{ done: 3, total: 9 }}
        projects={projects}
        current="p1"
        open={open}
        onToggle={() => setOpen((o) => !o)}
        onPick={onPick}
        onOpenFolder={onOpenFolder}
      />
    </div>
  );
}

const meta = { title: 'Shell/ProjectSwitcher', component: Switcher, args: { conn: 'live', onPick: fn(), onOpenFolder: fn() } } satisfies Meta<typeof Switcher>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    expect(c.getByRole('button', { name: /Recipe Box/ }).textContent).toBe('Recipe Box3/9 done');
    await userEvent.click(c.getByRole('button', { name: /Recipe Box/ }));
    expect(c.getAllByRole('menuitemradio')).toHaveLength(2);
  },
};

export const Open: Story = { args: { open: true } };

export const Reconnecting: Story = { args: { conn: 'reconnecting' } };

export const Disconnected: Story = { args: { conn: 'disconnected' } };

/** No connection dot: the docs page. */
export const NoConnection: Story = { args: { conn: undefined } };

export const Narrow: Story = { decorators: [narrow] };
