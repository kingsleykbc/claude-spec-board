import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { ConflictError } from '@/api/client';
import { fileProblemSpec, recipeArchived, recipeSpec, recipeSpecs } from '@/fixtures/recipeBox';
import { createMutator } from '@/state/mutate';
import { SimpleMode } from '@/state/simpleMode';
import { CardDetail, type DetailClient } from './card-detail';
import { RUN_LINES, RunPanel } from './run-panel/run-panel';
import { narrow } from '@/stories/narrow-screen';

const client = (over: Partial<DetailClient> = {}): DetailClient => ({
  setMeta: fn(async (_pid: string, id: string) => ({ hash: 'h2', spec: recipeSpec(id) })) as unknown as DetailClient['setMeta'],
  setBody: fn(async (_pid: string, id: string) => ({ hash: 'h2', spec: recipeSpec(id) })),
  specDraftCopy: fn(async () => ({ path: '.specboard/specs/T-104-meal-planner-calendar/spec.draft.md' })),
  setAnswers: fn(async (_pid: string, id: string) => ({ hash: 'h2', spec: recipeSpec(id) })),
  setSubtask: fn(async (_pid: string, id: string) => ({ hash: 'h2', spec: recipeSpec(id) })),
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
    expect(within(dlg).getByRole('button', { name: 'Edit' })).toBeTruthy();
    expect(within(dlg).queryByText('Blocked.')).toBeNull();
    expect(within(dlg).getByText('Created 2026-11-01 · Updated 2026-11-08')).toBeTruthy();
  },
};

export const EditMode: Story = {
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole('button', { name: 'Edit' }));
    const ta = c.getByRole('textbox', { name: 'Spec markdown' });
    expect(c.getByText('Markdown · preview on the right')).toBeTruthy();
    await userEvent.clear(ta);
    await userEvent.type(ta, 'Live **preview**');
    expect(c.getByText('preview').tagName).toBe('STRONG');
    await userEvent.click(c.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(args.toast).toHaveBeenCalledWith('ok', 'Spec saved', undefined, { path: '.specboard/specs/T-104-meal-planner-calendar/spec.md' }));
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
    expect(deps.getAttribute('data-highlight')).toBe('true');
  },
};

export const FileProblemState: Story = {
  name: 'File problem',
  args: { specId: 'T-109', onFixFile: fn() },
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    const alert = c.getByRole('alert');
    expect(within(alert).getByText('This spec file has a formatting problem')).toBeTruthy();
    await userEvent.click(within(alert).getByRole('button', { name: 'Ask Claude to fix' }));
    expect(args.onFixFile).toHaveBeenCalledOnce();
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
    await userEvent.click(c.getByRole('button', { name: 'Edit' }));
    await userEvent.type(c.getByRole('textbox', { name: 'Spec markdown' }), ' more');
    await userEvent.click(c.getByRole('button', { name: 'Save' }));
    const body = within(document.body);
    const dlg = await body.findByRole('alertdialog', { name: 'This spec changed outside the board' });
    expect(within(dlg).getAllByRole('button').map((b) => b.textContent)).toEqual(['Keep editing', 'Reload & keep my copy', 'Reload']);
  },
};

export const DiscardChanges: Story = {
  // × goes through the same guard as Esc and the scrim (the Esc path is covered by CardDetail.test.tsx).
  name: 'Close with unsaved changes',
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole('button', { name: 'Edit' }));
    const ta = c.getByRole('textbox', { name: 'Spec markdown' });
    await userEvent.type(ta, ' more');
    await userEvent.click(c.getByRole('button', { name: 'Close' }));
    const dlg = await within(document.body).findByRole('alertdialog', { name: 'Discard your changes?' });
    expect(document.activeElement).toBe(within(dlg).getByRole('button', { name: 'Keep editing' }));
    expect(args.onClose).not.toHaveBeenCalled();
  },
};

export const Missing: Story = {
  args: { specId: 'T-999' },
  play: async ({ canvasElement }) => {
    expect(within(canvasElement).getByText('This spec was removed or archived')).toBeTruthy();
  },
};

export const WorkingInChat: Story = {
  name: 'Working in a chat',
  args: { chat: 2 },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    expect(c.getByRole('button', { name: 'Not running? Clear' })).toBeTruthy();
    // Run with Claude is held while Claude works in a chat.
    expect(c.getAllByText('Claude is working on this in a chat.').length).toBeGreaterThan(0);
    expect((c.getByRole('button', { name: 'Run with Claude' }) as HTMLButtonElement).disabled).toBe(true);
    expect(c.queryByRole('button', { name: 'Copy run command' })).toBeNull();
  },
};

/** T-103 in Review: Run with Claude is held with a note saying what to do instead. */
export const RunInReview: Story = {
  name: 'Run: in Review',
  args: { specId: 'T-103' },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    expect(c.getByText('In Review: check the work, then move the card to Done.')).toBeTruthy();
    expect((c.getByRole('button', { name: 'Run with Claude' }) as HTMLButtonElement).disabled).toBe(true);
    expect(c.queryByRole('button', { name: 'Copy run command' })).toBeNull();
  },
};

/**
 * A blocked draft dragged to Done before it was built (T-107, needing T-104): it keeps its Draft badge, but has no
 * write-up button, no blocked banner, and Run with Claude is held as Already done.
 */
export const DraftInDone: Story = {
  args: {
    specId: 'T-107',
    specs: recipeSpecs.map((s) =>
      s.id === 'T-107' ? { ...s, status: 'done' as const, dependsOn: ['T-104'], blocked: true, blockedReasons: ['Waiting on T-104 (doing)'] } : s,
    ),
    onWriteUp: fn(),
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    expect(c.getByText('Draft')).toBeTruthy();
    expect(c.queryByRole('button', { name: /Have Claude write this up/ })).toBeNull();
    expect(c.queryByText('Blocked.')).toBeNull();
    expect(c.getByText('Already done.')).toBeTruthy();
    expect((c.getByRole('button', { name: 'Run with Claude' }) as HTMLButtonElement).disabled).toBe(true);
    expect(c.queryByRole('button', { name: 'Copy run command' })).toBeNull();
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

/** A path with no spaces, longer than the row: all of it stays readable, inside the dialog. */
export const RunFallbackLongPath: Story = {
  name: 'Run: fallback with a long path',
  args: { runState: 'fallback', runBlockedNote: `Claude Code didn’t start. A folder inside a registered project (C:\\Users\\someone\\Documents\\AVeryLongFolderNameWithNoSpacesAtAllThatKeepsGoingAndGoing\\AnotherVeryLongFolderNameWithNoSpacesThatKeepsGoing\\.venv\\Scripts\\claude.cmd) was left out of its PATH, which may be why.` },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const note = await c.findByText(/left out of its PATH/);
    const close = c.getByRole('button', { name: 'Close' });
    expect(note.scrollWidth).toBeLessThanOrEqual(note.clientWidth);
    expect(note.getBoundingClientRect().height).toBeGreaterThan(20); // it wrapped, rather than cutting the path off
    // The close button sits top right, above the actions row: the note must not run under it.
    const n = note.getBoundingClientRect();
    const x = close.getBoundingClientRect();
    expect(n.right <= x.left || n.left >= x.right || n.bottom <= x.top || n.top >= x.bottom).toBe(true);
    const dialog = c.getByRole('dialog').getBoundingClientRect();
    expect(close.getBoundingClientRect().right).toBeLessThanOrEqual(dialog.right);
  },
};

export const WithRunPanel: Story = {
  name: 'With run output',
  args: {
    runState: 'running',
    runActive: true,
    aside: () => <RunPanel status="running" lines={RUN_LINES} onDismiss={() => undefined} onAction={() => undefined} />,
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const dlg = c.getByRole('dialog', { name: 'Meal planner calendar' });
    expect(within(dlg).getByRole('complementary', { name: 'Run output' })).toBeTruthy();
    expect(dlg.style.width).toBe('min(1240px, 100%)');
    expect(within(dlg).getByText('In progress')).toBeTruthy();
  },
};

/** Simple mode: urgency, categories and dependencies sit in the ⋯ menu in the header. */
export const Simple: Story = {
  args: { specId: 'T-105' },
  decorators: [(Story) => <SimpleMode value>{Story()}</SimpleMode>],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement.ownerDocument.body);
    expect(c.queryByRole('radiogroup', { name: 'Urgency' })).toBeNull();
    await userEvent.click(c.getByRole('button', { name: 'More details' }));
    const menu = within(c.getByRole('dialog', { name: 'More details' }));
    expect(menu.getByRole('radiogroup', { name: 'Urgency' })).toBeTruthy();
    expect(menu.getByText('Depends on')).toBeTruthy();
  },
};

/** T-101's second subtask is obsolete: its log shows a warning icon that opens a popover with the reason. */
export const ObsoleteLog: Story = {
  name: 'Obsolete subtask log',
  args: { specId: 'T-101' },
  play: async ({ canvasElement }) => {
    const row = canvasElement.ownerDocument.querySelector<HTMLElement>('[data-subtask="2"]')!;
    await userEvent.click(within(row).getByRole('button', { name: /Log/ }));
    await userEvent.click(within(row).getByRole('button', { name: 'Obsolete' }));
    const pop = await within(canvasElement.ownerDocument.body).findByRole('dialog', { name: 'Obsolete' });
    expect(within(pop).getByText('Since 2026-11-10: the fixed grid was replaced by a responsive one')).toBeTruthy();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(within(canvasElement.ownerDocument.body).queryByRole('dialog', { name: 'Obsolete' })).toBeNull());
    expect(within(canvasElement.ownerDocument.body).getByRole('dialog', { name: 'Recipe list page' })).toBeTruthy();
  },
};

/** 720px and under: the status menu is a bottom drawer over the detail; picking a status keeps the detail open. */
export const NarrowStatus: Story = {
  name: 'Narrow: status drawer',
  decorators: [narrow],
  play: async ({ canvasElement, args }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(body.getByRole('button', { name: 'Doing' }));
    const sheet = await body.findByRole('dialog', { name: 'Status' });
    await userEvent.click(within(sheet).getByRole('menuitemradio', { name: /Review/ }));
    await waitFor(() => expect(body.queryByRole('dialog', { name: 'Status' })).toBeNull());
    expect(args.onMove).toHaveBeenCalledWith(expect.objectContaining({ id: 'T-104' }), 'review');
    expect(args.onClose).not.toHaveBeenCalled();
    const dlg = body.getByRole('dialog', { name: 'Meal planner calendar' });
    await waitFor(() => expect(dlg.contains(document.activeElement)).toBe(true));
    // Esc closes only the drawer (after its slide-out), and focus goes back to the status button.
    const btn = within(dlg).getByRole('button', { name: 'Doing' });
    await userEvent.click(btn);
    await body.findByRole('dialog', { name: 'Status' });
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(body.queryByRole('dialog', { name: 'Status' })).toBeNull(), { timeout: 2000 });
    expect(args.onClose).not.toHaveBeenCalled();
    expect(body.getByRole('dialog', { name: 'Meal planner calendar' })).toBe(dlg);
    await waitFor(() => expect(document.activeElement).toBe(btn));
  },
};
