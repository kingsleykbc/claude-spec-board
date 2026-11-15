import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { recipeProject } from '@/fixtures/recipeBox';
import { LogsModal } from './logs-modal';

const meta = {
  title: 'Modals/Logs',
  component: LogsModal,
  args: { project: recipeProject, onOpenSpec: fn(), onOpenOverview: fn(), onClose: fn(), now: new Date(2026, 10, 14, 12, 0) },
} satisfies Meta<typeof LogsModal>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Time on the left (time ago, the exact time in a tooltip), the spec, subtask and text on the right. */
export const Grid: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const rows = await c.findAllByRole('row');
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(within(r).getAllByRole('cell')).toHaveLength(2);
    expect(c.queryByRole('heading', { level: 2 })).toBeNull();
    expect(c.getByText(/draggable recipe sidebar/)).toBeTruthy();
  },
};

/** One log marked obsolete, with tokens: the icon opens a popover with the reason. */
export const WithTokensAndObsolete: Story = {
  args: {
    project: {
      ...recipeProject,
      archived: [],
      specs: [
        {
          ...recipeProject.specs[0]!,
          logs: {
            1: {
              subtask: 1,
              commit: null,
              files: [],
              pr: null,
              doneAt: null,
              tokens: 48200,
              obsolete: { since: '2026-11-12', reason: 'Replaced by the new planner' },
              problems: [],
              entries: [
                { at: '2026-11-08 09:00', text: 'First pass.' },
                { at: '2026-11-14 10:00', text: 'Second pass.' },
              ],
            },
          },
        },
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(await c.findByRole('button', { name: 'More info' }));
    expect(await c.findByText('48.2k tokens')).toBeTruthy();
    expect(c.getAllByRole('button', { name: 'Obsolete' }).length).toBeGreaterThan(0);
  },
};

/** The newest row of a log with files, a commit, a PR and tokens has a collapsed More info. */
export const MoreInfo: Story = {
  args: {
    project: {
      ...recipeProject,
      archived: [],
      specs: [
        {
          ...recipeProject.specs[0]!,
          logs: {
            1: {
              subtask: 1,
              commit: '4f2a91c',
              files: ['src/pages/Planner.tsx'],
              pr: 'https://github.com/o/r/pull/7',
              doneAt: null,
              tokens: 48200,
              obsolete: null,
              problems: [],
              entries: [
                { at: '2026-11-08 09:00', text: 'First pass.' },
                { at: '2026-11-14 10:00', text: 'Second pass.' },
              ],
            },
          },
        },
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const btn = await c.findByRole('button', { name: 'More info' });
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    await userEvent.click(btn);
    expect(c.getByText('src/pages/Planner.tsx')).toBeTruthy();
  },
};

export const Search: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.type(await c.findByRole('searchbox', { name: 'Search logs' }), 'zzzzqq');
    expect(c.getByText('No logs match “zzzzqq”.')).toBeTruthy();
  },
};

export const Empty: Story = {
  args: { project: { ...recipeProject, specs: [], archived: [] } },
  play: async ({ canvasElement }) => {
    expect(await within(canvasElement).findByText('No logs yet.')).toBeTruthy();
  },
};
