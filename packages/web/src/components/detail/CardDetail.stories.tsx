import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { ConflictError } from '../../api/client';
import { fileProblemSpec, recipeArchived, recipeSpec, recipeSpecs } from '../../fixtures/recipeBox';
import { createMutator } from '../../state/mutate';
import { CardDetail, type DetailClient } from './CardDetail';

const client = (over: Partial<DetailClient> = {}): DetailClient => ({
  setMeta: fn(async (_pid: string, id: string) => ({ hash: 'h2', spec: recipeSpec(id) })) as unknown as DetailClient['setMeta'],
  setBody: fn(async (_pid: string, id: string) => ({ hash: 'h2', spec: recipeSpec(id) })),
  specDraftCopy: fn(async () => ({ path: '.specboard/specs/T-104-meal-planner-calendar/spec.draft.md' })),
  claude: fn(async () => ({ stub: true })),
  ...over,
});

const meta = {
  title: 'Detail/CardDetail',
  component: CardDetail,
  args: {
    pid: 'p1',
    specId: 'T-104',
    root: 'examples/recipe-box',
    specs: [...recipeSpecs, fileProblemSpec],
    archived: recipeArchived,
    client: client(),
    mutate: createMutator(() => Promise.reject(new Error('no default op'))),
    refresh: fn(async () => undefined),
    toast: fn(),
    onMove: fn(),
    onClose: fn(),
  },
} satisfies Meta<typeof CardDetail>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ReadMode: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const dlg = c.getByRole('dialog', { name: 'Meal planner calendar' });
    expect(within(dlg).getByText('.specboard/specs/T-104-meal-planner-calendar/spec.md')).toBeTruthy();
    expect(within(dlg).getByRole('button', { name: '✎ Edit' })).toBeTruthy();
    expect(within(dlg).queryByText('Blocked.')).toBeNull();
  },
};

export const EditMode: Story = {
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole('button', { name: '✎ Edit' }));
    const ta = c.getByRole('textbox', { name: 'Spec markdown' });
    expect(c.getByText('Markdown · preview on the right')).toBeTruthy();
    await userEvent.clear(ta);
    await userEvent.type(ta, 'Live **preview**');
    expect(c.getByText('preview').tagName).toBe('STRONG');
    await userEvent.click(c.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(args.toast).toHaveBeenCalledWith('ok', 'Spec saved', '.specboard/specs/T-104-meal-planner-calendar/spec.md'));
  },
};

export const Blocked: Story = {
  args: { specId: 'T-105' },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const banner = c.getByRole('status');
    expect(within(banner).getByText('Blocked.')).toBeTruthy();
    await userEvent.click(within(banner).getByRole('button', { name: /^Waiting on T-104 Meal planner calendar \(Doing\)$/ }));
    const deps = canvasElement.querySelector<HTMLElement>('[data-section="dependencies"]')!;
    expect(deps.style.borderColor).toBe('var(--accent)');
  },
};

export const FileProblemState: Story = {
  name: 'File problem',
  args: { specId: 'T-109' },
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    const alert = c.getByRole('alert');
    expect(within(alert).getByText('This spec file has a formatting problem')).toBeTruthy();
    await userEvent.click(within(alert).getByRole('button', { name: 'Ask Claude to fix' }));
    await waitFor(() => expect(args.toast).toHaveBeenCalledWith('info', 'Claude actions arrive in the next milestone'));
  },
};

export const Conflict: Story = {
  args: {
    client: client({
      setBody: fn(async () => {
        throw new ConflictError('h9', 'theirs');
      }),
    }),
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole('button', { name: '✎ Edit' }));
    await userEvent.type(c.getByRole('textbox', { name: 'Spec markdown' }), ' more');
    await userEvent.click(c.getByRole('button', { name: 'Save' }));
    const body = within(document.body);
    const dlg = await body.findByRole('alertdialog', { name: 'This spec changed outside the board' });
    expect(within(dlg).getAllByRole('button').map((b) => b.textContent)).toEqual(['Keep editing', 'Reload & keep my copy', 'Reload']);
  },
};

export const Missing: Story = {
  args: { specId: 'T-999' },
  play: async ({ canvasElement }) => {
    expect(within(canvasElement).getByText('This spec was removed or archived')).toBeTruthy();
  },
};

export const RunRunning: Story = {
  name: 'Run: running',
  args: { runState: 'running' },
  play: async ({ canvasElement }) => {
    expect(within(canvasElement).getByRole('button', { name: 'Stop' })).toBeTruthy();
  },
};

export const RunDisabled: Story = {
  name: 'Run: disabled',
  args: { runState: 'disabled', runningId: 'T-103' },
  play: async ({ canvasElement }) => {
    expect(within(canvasElement).getByText('Claude is already working on T-103')).toBeTruthy();
  },
};

export const RunFallback: Story = {
  name: 'Run: Claude Code not found',
  args: { runState: 'fallback' },
  play: async ({ canvasElement }) => {
    expect(within(canvasElement).getByText('Claude Code not found')).toBeTruthy();
  },
};
