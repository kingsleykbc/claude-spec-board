import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ProjectSwitcher, type SwitcherProject } from './project-switcher';
import type { Conn } from '@/api/live';
import { narrow } from '@/stories/narrow-screen';

const projects: SwitcherProject[] = [
  { id: 'p1', name: 'Recipe Box', root: '~/code/recipe-box', progress: { done: 3, total: 9 }, available: true },
  { id: 'p2', name: 'Empty', root: '~/code/empty', progress: { done: 0, total: 0 }, available: false },
];

function Switcher({ conn, onOpen, onPick, onOpenFolder }: { conn?: Conn; onOpen: () => void; onPick: (id: string) => void; onOpenFolder: () => void }) {
  return (
    <div className="flex min-h-[300px] items-start p-3">
      <ProjectSwitcher
        {...(conn ? { conn } : {})}
        name="Recipe Box"
        progress={{ done: 3, total: 9 }}
        projects={projects}
        current="p1"
        onOpen={onOpen}
        onPick={onPick}
        onOpenFolder={onOpenFolder}
      />
    </div>
  );
}

const meta = {
  title: 'Shell/ProjectSwitcher',
  component: Switcher,
  args: { conn: 'live', onOpen: fn(), onPick: fn(), onOpenFolder: fn() },
} satisfies Meta<typeof Switcher>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {
  play: async ({ canvasElement }) => {
    expect(within(canvasElement).getByRole('button', { name: /Recipe Box/ }).textContent).toBe('Recipe Box3/9 done');
  },
};

/** Wide: a 300px dropdown with the projects, a tick on the current one, and "Open another project folder…". */
export const Open: Story = {
  play: async ({ canvasElement, args }) => {
    const body = within(document.body);
    await userEvent.click(within(canvasElement).getByRole('button', { name: /Recipe Box/ }));
    const menu = await body.findByRole('menu');
    expect(args.onOpen).toHaveBeenCalled();
    expect(within(menu).getAllByRole('menuitemradio')).toHaveLength(2);
    expect(Math.round(menu.getBoundingClientRect().width)).toBe(300);
    expect(within(menu).getByText('No specs yet')).toBeTruthy();
    await userEvent.keyboard('{Escape}');
  },
};

export const Reconnecting: Story = { args: { conn: 'reconnecting' } };

export const Disconnected: Story = { args: { conn: 'disconnected' } };

/** No connection dot: the docs page. */
export const NoConnection: Story = { args: { conn: undefined } };

/** A phone (720px and under): no progress text on the button, and the menu opens as a bottom drawer that fits the screen. */
export const Narrow: Story = {
  decorators: [narrow],
  play: async ({ canvasElement }) => {
    const body = within(document.body);
    await userEvent.click(within(canvasElement).getByRole('button', { name: /Recipe Box/ }));
    const sheet = await body.findByRole('dialog', { name: 'Projects' });
    expect(within(sheet).getAllByRole('menuitemradio')).toHaveLength(2);
    expect(sheet.getBoundingClientRect().right).toBeLessThanOrEqual(window.innerWidth);
    await userEvent.keyboard('{Escape}');
  },
};
