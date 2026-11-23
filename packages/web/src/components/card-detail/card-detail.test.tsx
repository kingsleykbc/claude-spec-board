import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { composeStories } from '@storybook/react-vite';
import type { Spec, Status } from '@specboard/core';
import { ConflictError } from '@/api/client';
import { recipeArchived, recipeSpec, recipeSpecs, fileProblemSpec } from '@/fixtures/recipeBox';
import { createSpecActions } from '@/state/actions';
import { createMutator } from '@/state/mutate';
import { interceptPop } from '@/lib/popGuard';
import { datesLine, type CardDetailProps, type DetailClient } from './card-detail';
import * as stories from './card-detail.stories';

const { ReadMode, WorkingInChat, ObsoleteLog, Simple, NarrowStatus } = composeStories(stories);

const ROOT = 'examples/recipe-box';

function setup(id: string, over: Partial<DetailClient> = {}, specs: Spec[] = [...recipeSpecs, fileProblemSpec], extra: Pick<CardDetailProps, 'canAutoRun' | 'startRun' | 'refreshing'> = {}) {
  const client = {
    setMeta: vi.fn(async (_pid: string, sid: string) => ({ hash: 'h2', spec: recipeSpec(sid) })),
    setBody: vi.fn(async (_pid: string, sid: string) => ({ hash: 'h2', spec: recipeSpec(sid) })),
    specDraftCopy: vi.fn(async () => ({ path: '.specboard/specs/T-105-shopping-list-export/spec.draft.md' })),
    setAnswers: vi.fn(async (_pid: string, sid: string) => ({ hash: 'h2', spec: recipeSpec(sid) })),
    setSubtask: vi.fn(async (_pid: string, sid: string) => ({ hash: 'h2', spec: recipeSpec(sid) })),
    archive: vi.fn(async () => undefined),
    unarchive: vi.fn(async () => undefined),
    ...over,
  };
  const toast = vi.fn();
  const refresh = vi.fn(async () => undefined);
  const mutate = createMutator(() => Promise.reject(new Error('no default')));
  const actions = createSpecActions({ pid: 'p1', client, mutate, refresh, toast });
  const onClose = vi.fn();
  const onOpenSpec = vi.fn();
  const onRun = vi.fn();
  const onFixFile = vi.fn();
  const el = (list: Spec[], down = false) => (
    <ReadMode
      pid="p1"
      specId={id}
      root={ROOT}
      specs={list}
      archived={recipeArchived}
      client={client}
      mutate={mutate}
      refresh={refresh}
      toast={toast}
      onMove={vi.fn((s: Spec, k: Status) => actions.move(s, k))}
      onClose={onClose}
      onOpenSpec={onOpenSpec}
      onRun={onRun}
      onFixFile={onFixFile}
      down={down}
      {...extra}
    />
  );
  const r = render(el(specs));
  /** Re-render with this spec replaced by `next` (a live update). */
  const update = (next: Spec) => r.rerender(el(specs.map((x) => (x.id === id ? next : x))));
  return { client, toast, refresh, mutate, onClose, onOpenSpec, onRun, onFixFile, update, rerenderWith: (list: Spec[]) => r.rerender(el(list)), rerenderDown: () => r.rerender(el(specs, true)) };
}

const startEdit = (text: string) => {
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Spec markdown' }), { target: { value: text } });
};
const conflict = () =>
  vi.fn(async () => {
    throw new ConflictError('h9', 'theirs');
  });

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('CardDetail', () => {
  it('shows the ID, the project-relative path, the title and the spec Markdown', () => {
    setup('T-104');
    const dlg = screen.getByRole('dialog', { name: 'Meal planner calendar' });
    expect(within(dlg).getByText('T-104')).toBeTruthy();
    expect(within(dlg).getByText('.specboard/specs/T-104-meal-planner-calendar/spec.md')).toBeTruthy();
    expect(within(dlg).getByRole('heading', { level: 1, name: 'Meal planner calendar' })).toBeTruthy();
    expect(within(dlg).getByText('SPEC')).toBeTruthy();
  });

  it('ends with a dates footer, leaving out a missing date and showing nothing without both', () => {
    const spec = recipeSpec('T-104');
    const { rerenderWith } = setup('T-104');
    expect(screen.getByText('Created 2026-11-01 · Updated 2026-11-08')).toBeTruthy();
    rerenderWith([{ ...spec, created: null }]);
    expect(screen.getByText('Updated 2026-11-08')).toBeTruthy();
    rerenderWith([{ ...spec, updated: null }]);
    expect(screen.getByText('Created 2026-11-01')).toBeTruthy();
    rerenderWith([{ ...spec, created: null, updated: null }]);
    expect(screen.queryByText(/Created|Updated/)).toBeNull();
    expect(datesLine(null, null)).toBeNull();
    expect(datesLine('2026-11-01', '2026-11-08')).toBe('Created 2026-11-01 · Updated 2026-11-08');
  });

  it('shows "This spec was removed or archived" with a Close button when the spec is gone', () => {
    const { onClose } = setup('T-999');
    expect(screen.getByText('This spec was removed or archived')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('a spec that disappears after a refresh shows the removed message (Review Focus 4)', () => {
    const { rerenderWith, onClose } = setup('T-104');
    expect(screen.getByRole('dialog', { name: 'Meal planner calendar' })).toBeTruthy();
    rerenderWith([...recipeSpecs, fileProblemSpec].filter((x) => x.id !== 'T-104'));
    expect(screen.queryByRole('dialog', { name: 'Meal planner calendar' })).toBeNull();
    expect(screen.getByText('This spec was removed or archived')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows Open questions, Dependencies and Subtasks; a dependency opens that spec', () => {
    const { onOpenSpec } = setup('T-105');
    const q = document.querySelector('[data-section="questions"]') as HTMLElement;
    expect(within(q).getByText('3 waiting on you')).toBeTruthy();
    const deps = document.querySelector('[data-section="dependencies"]') as HTMLElement;
    fireEvent.click(within(deps).getByRole('button', { name: /T-104/ }));
    expect(onOpenSpec).toHaveBeenCalledWith('T-104');
    expect(screen.getByText('0 of 5 done')).toBeTruthy();
  });

  it('orders the sections: Spec, Attachments, Open questions, Subtasks, To review', () => {
    setup('T-103');
    const labels = [...document.querySelectorAll('[data-detail-scroll] > section')].map((x) => x.getAttribute('aria-label'));
    const want = ['Spec', 'Attachments', 'Subtasks', 'To review'];
    expect(labels.filter((l) => want.includes(l ?? ''))).toEqual(want);
  });

  it('hides To review without items and shows Attachments for an active spec', () => {
    setup('T-104');
    expect(screen.queryByRole('region', { name: 'To review' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Attachments' })).toBeTruthy();
  });

  it('opens archived specs', () => {
    setup('T-100');
    expect(screen.getByRole('dialog', { name: 'Project scaffold' })).toBeTruthy();
  });

  it('status menu marks Current and Approve; picking Done sends status done and toasts approved', async () => {
    const user = userEvent.setup();
    const { client, toast } = setup('T-103');
    await user.click(screen.getByRole('button', { name: 'Review' }));
    const menu = await screen.findByRole('menu', { name: 'Status' });
    const items = within(menu).getAllByRole('menuitemradio');
    expect(items.map((i) => i.textContent)).toEqual(['To-do', 'Doing', 'ReviewCurrent', 'DoneApprove']);
    expect(items[2]!.getAttribute('aria-checked')).toBe('true');
    await user.click(items[3]!);
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    await waitFor(() => expect(toast).toHaveBeenCalledWith('ok', 'T-103 approved', 'Moved to Done.'));
    expect(client.setMeta).toHaveBeenCalledWith('p1', 'T-103', recipeSpec('T-103').hash, 'status', 'done');
  });

  it('an urgency click sends urgency', async () => {
    const { client, refresh } = setup('T-104');
    const group = screen.getByRole('radiogroup', { name: 'Urgency' });
    expect(within(group).getByRole('radio', { name: /High/ }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(within(group).getByRole('radio', { name: /Urgent/ }));
    // Optimistic until the write and refresh finish.
    expect(within(group).getByRole('radio', { name: /Urgent/ }).getAttribute('aria-checked')).toBe('true');
    await waitFor(() => expect(client.setMeta).toHaveBeenCalledWith('p1', 'T-104', recipeSpec('T-104').hash, 'urgency', 'urgent'));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('adding the category Infra appends it; suggestions filter and offer Create', async () => {
    const { client } = setup('T-104');
    fireEvent.click(screen.getByRole('button', { name: 'Category' }));
    const input = screen.getByPlaceholderText('Category…');
    // Every project category not on the spec (Infra comes from archived T-100).
    const names = () => screen.getAllByRole('option').map((o) => o.textContent);
    expect(names()).toEqual(['Backend', 'Auth', 'Infra']);
    fireEvent.change(input, { target: { value: 'in' } });
    expect(names()).toEqual(['Infra', 'Create “in”']);
    fireEvent.change(input, { target: { value: 'Payments' } });
    expect(names()).toEqual(['Create “Payments”']);
    fireEvent.change(input, { target: { value: 'Inf' } });
    fireEvent.mouseDown(screen.getByRole('option', { name: 'Infra' }));
    await waitFor(() =>
      expect(client.setMeta).toHaveBeenCalledWith('p1', 'T-104', recipeSpec('T-104').hash, 'categories', ['Frontend', 'Infra']),
    );
    expect(screen.queryByPlaceholderText('Category…')).toBeNull();
  });

  it('Enter in the category input adds the typed text; × removes a category', async () => {
    const { client } = setup('T-103');
    fireEvent.click(screen.getByRole('button', { name: 'Category' }));
    const input = screen.getByPlaceholderText('Category…');
    fireEvent.change(input, { target: { value: 'Payments' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() =>
      expect(client.setMeta).toHaveBeenCalledWith('p1', 'T-103', expect.any(String), 'categories', ['Frontend', 'Backend', 'Payments']),
    );
    await waitFor(() => expect(screen.getByRole('button', { name: 'Remove category Frontend' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Remove category Frontend' }));
    await waitFor(() => expect(client.setMeta).toHaveBeenLastCalledWith('p1', 'T-103', expect.any(String), 'categories', ['Backend']));
  });

  it('rapid category adds build on each other and chain hashes (Review Focus 3)', async () => {
    const { client } = setup('T-103');
    for (const name of ['X', 'Y']) {
      fireEvent.click(screen.getByRole('button', { name: 'Category' }));
      const input = screen.getByPlaceholderText('Category…');
      fireEvent.change(input, { target: { value: name } });
      fireEvent.keyDown(input, { key: 'Enter' });
    }
    await waitFor(() => expect(client.setMeta).toHaveBeenCalledTimes(2));
    expect(client.setMeta).toHaveBeenNthCalledWith(1, 'p1', 'T-103', recipeSpec('T-103').hash, 'categories', ['Frontend', 'Backend', 'X']);
    expect(client.setMeta).toHaveBeenNthCalledWith(2, 'p1', 'T-103', 'h2', 'categories', ['Frontend', 'Backend', 'X', 'Y']);
  });

  it('saving an edit sends PATCH body with the current hash and the bodyHash from when editing began', async () => {
    const { client, toast } = setup('T-104');
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByText('Markdown · preview on the right')).toBeTruthy();
    const ta = screen.getByRole('textbox', { name: 'Spec markdown' }) as HTMLTextAreaElement;
    expect(ta.value).toBe(recipeSpec('T-104').bodyMd);
    fireEvent.change(ta, { target: { value: 'New **text**' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith('ok', 'Spec saved', undefined, { path: '.specboard/specs/T-104-meal-planner-calendar/spec.md' }));
    expect(client.setBody).toHaveBeenCalledWith('p1', 'T-104', recipeSpec('T-104').hash, recipeSpec('T-104').bodyHash, 'New **text**');
    expect(screen.queryByRole('textbox', { name: 'Spec markdown' })).toBeNull();
  });

  it('a 409 on save opens the conflict dialog; Reload & keep my copy writes a draft copy', async () => {
    const setBody = vi.fn(async () => {
      throw new ConflictError('h9', 'theirs');
    });
    const { client, toast, refresh } = setup('T-105', { setBody });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Spec markdown' }), { target: { value: 'mine' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    const dlg = await screen.findByRole('alertdialog', { name: 'This spec changed outside the board' });
    expect(within(dlg).getByText('.specboard/specs/T-105-shopping-list-export/spec.md')).toBeTruthy();
    expect(within(dlg).getAllByRole('button').map((b) => b.textContent)).toEqual(['Keep editing', 'Reload & keep my copy', 'Reload']);
    fireEvent.click(within(dlg).getByRole('button', { name: 'Reload & keep my copy' }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith('ok', 'Reloaded latest version', 'Your text is saved as .specboard/specs/T-105-shopping-list-export/spec.draft.md'),
    );
    expect(client.specDraftCopy).toHaveBeenCalledWith('p1', 'T-105', 'mine');
    expect(refresh).toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Spec markdown' })).toBeNull();
  });

  it('conflict: Keep editing keeps the text; Reload discards it', async () => {
    const setBody = vi.fn(async () => {
      throw new ConflictError('h9', 'theirs');
    });
    const { toast } = setup('T-105', { setBody });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Spec markdown' }), { target: { value: 'mine' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Keep editing' }));
    expect((screen.getByRole('textbox', { name: 'Spec markdown' }) as HTMLTextAreaElement).value).toBe('mine');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Reload' }));
    expect(toast).toHaveBeenCalledWith('info', 'Reloaded latest version', 'Your unsaved changes were discarded.');
    expect(screen.queryByRole('textbox', { name: 'Spec markdown' })).toBeNull();
  });

  it('the T-105 banner lists the question labels cut to 40 characters, and the dependency', () => {
    setup('T-105');
    const banner = screen.getByRole('status');
    expect(within(banner).getByText('Blocked.')).toBeTruthy();
    expect(
      within(banner).getByRole('button', {
        name: 'Awaiting answers on: Should the export include quantities?, How many weeks ahead should the list co…, Preferred export format?',
      }),
    ).toBeTruthy();
    expect(within(banner).getByRole('button', { name: 'Waiting on T-104 Meal planner calendar (Doing)' })).toBeTruthy();
  });

  it('clicking a reason scrolls to its section and flashes its border accent for 1.6 s', () => {
    vi.useFakeTimers();
    setup('T-105');
    const scroller = document.querySelector('[data-detail-scroll]') as HTMLElement;
    scroller.scrollTo = vi.fn() as unknown as typeof scroller.scrollTo;
    const deps = document.querySelector('[data-section="dependencies"]') as HTMLElement;
    fireEvent.click(screen.getByRole('button', { name: /^Waiting on T-104/ }));
    expect(scroller.scrollTo).toHaveBeenCalled();
    expect(deps.getAttribute('data-highlight')).toBe('true');
    act(() => vi.advanceTimersByTime(1600));
    expect(deps.getAttribute('data-highlight')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: /^Awaiting answers on/ }));
    expect(document.querySelector('[data-section="questions"]')!.getAttribute('data-highlight')).toBe('true');
  });

  it('no banner when the spec is not blocked', () => {
    setup('T-104');
    expect(screen.queryByText('Blocked.')).toBeNull();
  });

  it('file problem panel shows the problem and path; Ask Claude to fix asks for the fix', () => {
    const { onFixFile } = setup('T-109');
    const alert = screen.getByRole('alert');
    expect(within(alert).getByText('This spec file has a formatting problem')).toBeTruthy();
    expect(within(alert).getByText(fileProblemSpec.problems[0]!)).toBeTruthy();
    expect(within(alert).getByText('.specboard/specs/T-109-import-recipes-from-a-file/spec.md')).toBeTruthy();
    fireEvent.click(within(alert).getByRole('button', { name: 'Ask Claude to fix' }));
    expect(onFixFile).toHaveBeenCalledOnce();
  });

  it('Run asks for a run', () => {
    const { onRun } = setup('T-104');
    fireEvent.click(screen.getByRole('button', { name: /Run with Claude/ }));
    expect(onRun).toHaveBeenCalledOnce();
  });

  it('Esc closes the innermost layer first: dialog, then category input, then status menu, then modal', async () => {
    const setBody = vi.fn(async () => {
      throw new ConflictError('h9', 'theirs');
    });
    const { onClose } = setup('T-105', { setBody });
    const esc = () => fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

    fireEvent.click(screen.getByRole('button', { name: 'Category' }));
    expect(screen.getByPlaceholderText('Category…')).toBeTruthy();
    esc();
    expect(screen.queryByPlaceholderText('Category…')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();

    await userEvent.setup().click(screen.getByRole('button', { name: 'To-do' }));
    expect(await screen.findByRole('menu', { name: 'Status' })).toBeTruthy();
    esc();
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(onClose).not.toHaveBeenCalled();

    startEdit('changed text');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('alertdialog');
    esc();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Spec markdown' })).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();

    // Back to the saved text: nothing unsaved, so the first Esc closes the editor, the second the modal.
    fireEvent.change(screen.getByRole('textbox', { name: 'Spec markdown' }), { target: { value: recipeSpec('T-105').bodyMd } });
    esc();
    expect(screen.queryByRole('textbox', { name: 'Spec markdown' })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    esc();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  describe('F3: every way out asks first while work is unsaved', () => {
    const discard = () => screen.getByRole('alertdialog', { name: 'Discard your changes?' });
    const depLink = () => within(screen.getByRole('region', { name: 'Dependencies' })).getByRole('button', { name: /^T-104/ });
    const answerYes = () => fireEvent.click(screen.getByRole('radio', { name: 'Yes' }));

    it('(a) a dependency link with unsaved spec text asks; Discard then opens the other spec', () => {
      const { onOpenSpec } = setup('T-105');
      startEdit('changed');
      fireEvent.click(depLink());
      expect(discard()).toBeTruthy();
      expect(onOpenSpec).not.toHaveBeenCalled();
      fireEvent.click(within(discard()).getByRole('button', { name: 'Keep editing' }));
      expect(onOpenSpec).not.toHaveBeenCalled();
      fireEvent.click(depLink());
      fireEvent.click(within(discard()).getByRole('button', { name: 'Discard' }));
      expect(onOpenSpec).toHaveBeenCalledWith('T-104');
    });

    it('(a) a dependency link with nothing unsaved opens directly', () => {
      const { onOpenSpec } = setup('T-105');
      fireEvent.click(depLink());
      expect(screen.queryByRole('alertdialog')).toBeNull();
      expect(onOpenSpec).toHaveBeenCalledWith('T-104');
    });

    it('(b) Back/Forward while dirty: the pop guard keeps the detail and asks; Discard leaves', () => {
      const { onClose } = setup('T-105');
      startEdit('changed');
      const leave = vi.fn();
      let blocked = false;
      act(() => {
        blocked = interceptPop(leave);
      });
      expect(blocked).toBe(true);
      expect(discard()).toBeTruthy();
      expect(leave).not.toHaveBeenCalled();
      fireEvent.click(within(discard()).getByRole('button', { name: 'Discard' }));
      expect(leave).toHaveBeenCalledTimes(1);
      expect(onClose).not.toHaveBeenCalled();
    });

    it('(b) Back/Forward with nothing unsaved is not intercepted', () => {
      setup('T-105');
      startEdit(recipeSpec('T-105').bodyMd);
      expect(interceptPop(vi.fn())).toBe(false);
    });

    it('(c) typed but unsaved answers: Esc, scrim, × and a dependency link all ask; Discard closes', () => {
      const { onClose, onOpenSpec } = setup('T-105');
      answerYes();
      fireEvent.keyDown(document.body, { key: 'Escape' });
      expect(discard()).toBeTruthy();
      fireEvent.click(within(discard()).getByRole('button', { name: 'Keep editing' }));
      const scrim = screen.getByRole('dialog', { name: 'Shopping list export' }).parentElement!;
      fireEvent.mouseDown(scrim);
      fireEvent.click(scrim);
      fireEvent.click(within(discard()).getByRole('button', { name: 'Keep editing' }));
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      fireEvent.click(within(discard()).getByRole('button', { name: 'Keep editing' }));
      fireEvent.click(depLink());
      fireEvent.click(within(discard()).getByRole('button', { name: 'Keep editing' }));
      let blocked = false;
      act(() => {
        blocked = interceptPop(vi.fn());
      });
      expect(blocked).toBe(true);
      fireEvent.click(within(discard()).getByRole('button', { name: 'Keep editing' }));
      expect(onClose).not.toHaveBeenCalled();
      expect(onOpenSpec).not.toHaveBeenCalled();
      expect((screen.getByRole('radio', { name: 'Yes' }) as HTMLInputElement).checked).toBe(true);
      fireEvent.keyDown(document.body, { key: 'Escape' });
      fireEvent.click(within(discard()).getByRole('button', { name: 'Discard' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('(e) beforeunload is registered while dirty and removed when clean', () => {
      const add = vi.spyOn(window, 'addEventListener');
      const remove = vi.spyOn(window, 'removeEventListener');
      setup('T-105');
      const registered = () => add.mock.calls.filter(([t]) => t === 'beforeunload');
      expect(registered()).toHaveLength(0);
      answerYes();
      expect(registered()).toHaveLength(1);
      const handler = registered()[0]![1] as (e: Event) => void;
      const e = new Event('beforeunload', { cancelable: true });
      handler(e);
      expect(e.defaultPrevented).toBe(true);
      fireEvent.click(screen.getByRole('radio', { name: 'No' }));
      expect(registered()).toHaveLength(1);
      cleanup();
      expect(remove.mock.calls.some(([t, h]) => t === 'beforeunload' && h === handler)).toBe(true);
      add.mockRestore();
      remove.mockRestore();
    });
  });

  describe('unsaved spec text (Ruling 17)', () => {
    it('Esc with changes opens "Discard your changes?" and keeps the modal open; Keep editing is focused', () => {
      const { onClose } = setup('T-104');
      startEdit('changed');
      fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
      const dlg = screen.getByRole('alertdialog', { name: 'Discard your changes?' });
      expect(within(dlg).getAllByRole('button').map((b) => b.textContent)).toEqual(['Keep editing', 'Discard']);
      expect(document.activeElement).toBe(within(dlg).getByRole('button', { name: 'Keep editing' }));
      expect(onClose).not.toHaveBeenCalled();
      fireEvent.click(within(dlg).getByRole('button', { name: 'Keep editing' }));
      expect(screen.queryByRole('alertdialog')).toBeNull();
      expect((screen.getByRole('textbox', { name: 'Spec markdown' }) as HTMLTextAreaElement).value).toBe('changed');
    });

    it('Discard drops the edit but not the modal; a second Esc closes the modal', () => {
      const { onClose } = setup('T-104');
      startEdit('changed');
      fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
      fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
      expect(screen.queryByRole('alertdialog')).toBeNull();
      expect(screen.queryByRole('textbox', { name: 'Spec markdown' })).toBeNull();
      expect(screen.getByRole('dialog', { name: 'Meal planner calendar' })).toBeTruthy();
      expect(onClose).not.toHaveBeenCalled();
      fireEvent.keyDown(document.body, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('a press that starts in the textarea and ends on the scrim does not close', () => {
      const { onClose } = setup('T-104');
      startEdit('changed');
      const scrim = screen.getByRole('dialog', { name: 'Meal planner calendar' }).parentElement!;
      fireEvent.mouseDown(screen.getByRole('textbox', { name: 'Spec markdown' }));
      fireEvent.click(scrim);
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });

    it('a scrim click with unsaved edits asks first; without edits it closes', () => {
      const { onClose } = setup('T-104');
      startEdit('changed');
      const scrim = screen.getByRole('dialog', { name: 'Meal planner calendar' }).parentElement!;
      fireEvent.mouseDown(scrim);
      fireEvent.click(scrim);
      expect(screen.getByRole('alertdialog', { name: 'Discard your changes?' })).toBeTruthy();
      expect(onClose).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
      fireEvent.mouseDown(scrim);
      fireEvent.click(scrim);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('save hash (F2: the server checks bodyHash)', () => {
    /** A fake server: body saves conflict when `bodyHash` is not the body currently on disk. */
    const server = (disk: { hash: string }) =>
      vi.fn(async (_p: string, sid: string, _hash: string, bodyHash: string, _md: string) => {
        if (bodyHash !== disk.hash) throw new ConflictError('h9', 'theirs');
        return { hash: 'h10', spec: recipeSpec(sid) };
      });

    it('status changed mid-edit (body unchanged): Save sends the current hash and the edit-start bodyHash, and succeeds', async () => {
      const start = recipeSpec('T-104');
      const setBody = server({ hash: start.bodyHash });
      const { toast, update } = setup('T-104', { setBody });
      startEdit('mine');
      update({ ...start, status: 'review', hash: 'hNew' });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(toast).toHaveBeenCalledWith('ok', 'Spec saved', undefined, { path: expect.any(String) }));
      expect(setBody).toHaveBeenCalledWith('p1', 'T-104', 'hNew', start.bodyHash, 'mine');
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });

    it('body changed mid-edit while another op on the spec is in flight: Save sends the edit-start bodyHash and opens the conflict dialog', async () => {
      const start = recipeSpec('T-104');
      const disk = { hash: start.bodyHash };
      const setBody = server(disk);
      const { update, mutate, toast } = setup('T-104', { setBody });
      startEdit('mine');
      // Another write on T-104 is still running, so the chain is active when Save is pressed.
      let finish: ((v: { hash: string }) => void) | undefined;
      const other = mutate('T-104', start.hash, () => new Promise<{ hash: string }>((r) => (finish = r)));
      await waitFor(() => expect(finish).toBeDefined());
      // Claude rewrites the body meanwhile.
      disk.hash = 'bodyByClaude';
      update({ ...start, bodyMd: 'Claude rewrote this', bodyHash: 'bodyByClaude', hash: 'hClaude' });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      expect(setBody).not.toHaveBeenCalled(); // queued behind the in-flight op
      await act(async () => finish!({ hash: 'hChain' }));
      await other;
      await screen.findByRole('alertdialog', { name: 'This spec changed outside the board' });
      expect(setBody).toHaveBeenCalledWith('p1', 'T-104', 'hChain', start.bodyHash, 'mine');
      expect(toast).not.toHaveBeenCalledWith('ok', 'Spec saved', expect.anything());
    });

    it('after a 409, Keep editing only refreshes; a Save over a changed body conflicts again, never overwrites', async () => {
      const start = recipeSpec('T-104');
      const setBody = server({ hash: 'bodyByClaude' });
      const { refresh, update, toast } = setup('T-104', { setBody });
      startEdit('mine');
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Keep editing' }));
      expect(refresh).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('alertdialog')).toBeNull();
      // The refresh delivers Claude's version, whose body the user has not seen.
      update({ ...start, bodyMd: 'Claude rewrote this', bodyHash: 'bodyByClaude', hash: 'h9' });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      await screen.findByRole('alertdialog', { name: 'This spec changed outside the board' });
      expect(setBody).toHaveBeenCalledTimes(2);
      expect(setBody).toHaveBeenLastCalledWith('p1', 'T-104', 'h9', start.bodyHash, 'mine');
      await expect(setBody.mock.results[1]!.value).rejects.toBeInstanceOf(ConflictError);
      expect(toast).not.toHaveBeenCalledWith('ok', 'Spec saved', expect.anything());
    });
  });

  it('while disconnected, edits show the offline toast and send nothing', () => {
    const client = { setMeta: vi.fn(), setBody: vi.fn(), specDraftCopy: vi.fn() };
    const toast = vi.fn();
    render(
      <ReadMode
        pid="p1"
        specId="T-104"
        root={ROOT}
        specs={recipeSpecs}
        archived={recipeArchived}
        client={client as unknown as DetailClient}
        mutate={createMutator(() => Promise.reject(new Error('x')))}
        refresh={vi.fn(async () => undefined)}
        toast={toast}
        onMove={vi.fn()}
        onClose={vi.fn()}
        down
      />,
    );
    fireEvent.click(screen.getByRole('radio', { name: /Low/ }));
    expect(client.setMeta).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith('err', 'Disconnected from the local server.', 'Edits won’t save until it’s back.');
  });

  describe('Review Focus 1: layers inside the dialog', () => {
    it('the status menu opens above the dialog; picking Review moves the spec and the dialog stays open', async () => {
      const user = userEvent.setup();
      const onMove = vi.fn();
      const onClose = vi.fn();
      render(<ReadMode onMove={onMove} onClose={onClose} />);
      await user.click(screen.getByRole('button', { name: 'Doing' }));
      const menu = await screen.findByRole('menu', { name: 'Status' });
      await user.click(within(menu).getByRole('menuitemradio', { name: /Review/ }));
      expect(onMove).toHaveBeenCalledWith(expect.objectContaining({ id: 'T-104' }), 'review');
      await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
      expect(screen.getByRole('dialog', { name: 'Meal planner calendar' })).toBeTruthy();
      expect(onClose).not.toHaveBeenCalled();
    });

    it('a scrim click with the status menu open closes only the menu; the next one closes the dialog', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<ReadMode onClose={onClose} />);
      const dlg = screen.getByRole('dialog', { name: 'Meal planner calendar' });
      await user.click(within(dlg).getByRole('button', { name: 'Doing' }));
      await screen.findByRole('menu', { name: 'Status' });
      await user.click(dlg.parentElement!);
      await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole('dialog', { name: 'Meal planner calendar' })).toBeTruthy();
      await user.click(dlg.parentElement!);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('a scrim click with the obsolete popover open closes only the popover', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<ObsoleteLog onClose={onClose} />);
      const row = document.querySelector<HTMLElement>('[data-subtask="2"]')!;
      await user.click(within(row).getByRole('button', { name: /Log/ }));
      await user.click(within(row).getByRole('button', { name: 'Obsolete' }));
      await screen.findByRole('dialog', { name: 'Obsolete' });
      const dlg = screen.getByRole('dialog', { name: 'Recipe list page' });
      await user.click(dlg.parentElement!);
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Obsolete' })).toBeNull());
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole('dialog', { name: 'Recipe list page' })).toBeTruthy();
    });

    it('Esc closes the obsolete popover first, and only the next Esc closes the dialog', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<ObsoleteLog onClose={onClose} />);
      const row = document.querySelector<HTMLElement>('[data-subtask="2"]')!;
      await user.click(within(row).getByRole('button', { name: /Log/ }));
      await user.click(within(row).getByRole('button', { name: 'Obsolete' }));
      const pop = await screen.findByRole('dialog', { name: 'Obsolete' });
      expect(within(pop).getByText('Since 2026-11-10: the fixed grid was replaced by a responsive one')).toBeTruthy();
      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Obsolete' })).toBeNull());
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole('dialog', { name: 'Recipe list page' })).toBeTruthy();
      await user.keyboard('{Escape}');
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    describe('narrow (720px): the status menu is a drawer over the dialog', () => {
      it('picking a status moves the spec, closes the drawer and keeps the dialog open, with focus inside it', async () => {
        const user = userEvent.setup();
        const onMove = vi.fn();
        const onClose = vi.fn();
        render(<NarrowStatus onMove={onMove} onClose={onClose} />);
        const dlg = screen.getByRole('dialog', { name: 'Meal planner calendar' });
        await user.click(within(dlg).getByRole('button', { name: 'Doing' }));
        const sheet = await screen.findByRole('dialog', { name: 'Status' });
        await user.click(within(sheet).getByRole('menuitemradio', { name: /Review/ }));
        expect(onMove).toHaveBeenCalledWith(expect.objectContaining({ id: 'T-104' }), 'review');
        await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Status' })).toBeNull());
        expect(onClose).not.toHaveBeenCalled();
        expect(screen.getByRole('dialog', { name: 'Meal planner calendar' })).toBe(dlg);
        await waitFor(() => expect(dlg.contains(document.activeElement)).toBe(true));
        // The page is usable again: nothing left hidden from assistive tech or blocked by the drawer.
        expect(dlg.closest('[aria-hidden="true"]')).toBeNull();
      });

      it('Esc closes only the drawer, focus goes back to the status button, and the next Esc closes the dialog', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(<NarrowStatus onClose={onClose} />);
        const dlg = screen.getByRole('dialog', { name: 'Meal planner calendar' });
        const btn = within(dlg).getByRole('button', { name: 'Doing' });
        await user.click(btn);
        await screen.findByRole('dialog', { name: 'Status' });
        await user.keyboard('{Escape}');
        const sheet = screen.getByRole('dialog', { name: 'Status' });
        expect(sheet.getAttribute('data-state')).toBe('closed');
        // happy-dom runs no CSS animations: end vaul's slide-out so Radix unmounts the drawer, as a browser would.
        fireEvent.animationEnd(sheet, { animationName: getComputedStyle(sheet).animationName });
        await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Status' })).toBeNull());
        expect(onClose).not.toHaveBeenCalled();
        expect(screen.getByRole('dialog', { name: 'Meal planner calendar' })).toBe(dlg);
        await waitFor(() => expect(document.activeElement).toBe(btn));
        await user.keyboard('{Escape}');
        expect(onClose).toHaveBeenCalledTimes(1);
      });
    });

    it('Simple mode: Esc closes the ⋯ popover without opening its tooltip, so the next Esc closes the dialog', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<Simple onClose={onClose} />);
      await user.click(screen.getByRole('button', { name: 'More details' }));
      await screen.findByRole('dialog', { name: 'More details' });
      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'More details' })).toBeNull());
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'More details' }));
      // Give a tooltip time to open (300 ms delay); none should.
      await new Promise((r) => setTimeout(r, 400));
      expect(screen.queryByRole('tooltip')).toBeNull();
      expect(onClose).not.toHaveBeenCalled();
      await user.keyboard('{Escape}');
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('with unsaved spec text, Esc asks before the dialog closes', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<ReadMode onClose={onClose} />);
      await user.click(screen.getByRole('button', { name: 'Edit' }));
      await user.type(screen.getByRole('textbox', { name: 'Spec markdown' }), ' more');
      await user.keyboard('{Escape}');
      expect(await screen.findByRole('alertdialog', { name: 'Discard your changes?' })).toBeTruthy();
      expect(onClose).not.toHaveBeenCalled();
      await user.click(screen.getByRole('button', { name: 'Discard' }));
      expect(screen.queryByRole('textbox', { name: 'Spec markdown' })).toBeNull();
      await user.keyboard('{Escape}');
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});

describe('questions refresh after a spec edit', () => {
  const flagged = (sid: string): Spec => ({ ...recipeSpec(sid), needsRefresh: '2026-11-15' });
  const setBody = vi.fn(async (_pid: string, sid: string) => ({ hash: 'h2', spec: flagged(sid) }));
  const save = async (toast: ReturnType<typeof vi.fn>) => {
    startEdit('New text');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith('ok', 'Spec saved', undefined, expect.anything()));
  };
  const warnings = () => [...screen.queryAllByRole('button', { name: 'Questions may be out of date' }), ...screen.queryAllByRole('button', { name: 'Subtasks may be out of date' })];

  it('connected and approved: saving a To-do spec the server flagged starts a refresh-questions run for it', async () => {
    const startRun = vi.fn(async () => undefined);
    const { toast, refresh } = setup('T-105', { setBody }, undefined, { canAutoRun: true, startRun });
    await save(toast);
    expect(startRun).toHaveBeenCalledTimes(1);
    expect(startRun).toHaveBeenCalledWith('refresh-questions', 'T-105');
    // Started before the board re-fetches, so the warning never flashes for a round trip.
    expect(startRun.mock.invocationCallOrder[0]).toBeLessThan(refresh.mock.invocationCallOrder.at(-1)!);
  });

  it('a start refusal (as run.start resolves it) is quiet: no error toast, and the flag stays with its warning', async () => {
    const startRun = vi.fn(async () => ({ ok: false as const, reason: 'busy' as const, message: 'Claude is busy' }));
    const { toast, update } = setup('T-105', { setBody }, undefined, { canAutoRun: true, startRun });
    await save(toast);
    update(flagged('T-105'));
    expect(startRun).toHaveBeenCalledTimes(1);
    expect(toast).not.toHaveBeenCalledWith('err', expect.anything(), expect.anything());
    expect(warnings()).toHaveLength(2);
  });

  it('a Review or Done spec never shows the warning, even when its file is flagged', () => {
    for (const sid of ['T-103', 'T-101']) {
      setup(sid, {}, [...recipeSpecs.filter((x) => x.id !== sid), flagged(sid)]);
      expect(warnings(), sid).toHaveLength(0);
      cleanup();
    }
  });

  it('not connected: no run starts, and both headings warn; hovering shows the copy', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('hover: hover'), media: q, addEventListener() {}, removeEventListener() {} }));
    try {
      const startRun = vi.fn(async () => undefined);
      const { toast, update } = setup('T-105', { setBody }, undefined, { canAutoRun: false, startRun });
      expect(warnings()).toHaveLength(0);
      await save(toast);
      update(flagged('T-105'));
      expect(startRun).not.toHaveBeenCalled();
      const [q, s] = warnings();
      expect(warnings()).toHaveLength(2);
      expect(within(screen.getByRole('region', { name: 'Open questions' })).getByRole('button', { name: 'Questions may be out of date' })).toBe(q);
      expect(s!.getAttribute('aria-label') ?? s!.textContent).toContain('Subtasks may be out of date');
      expect(s!.closest('section')?.textContent).toContain('SUBTASKS');
      fireEvent.pointerEnter(q!);
      expect(screen.getByRole('dialog', { name: 'Questions may be out of date' }).textContent).toContain(
        'These may be out of date after the last spec edit. Run /specboard:refresh-questions T-105 in Claude.',
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('no warning while a refresh run for this spec is going', () => {
    setup('T-105', {}, [...recipeSpecs.filter((x) => x.id !== 'T-105'), flagged('T-105')], { refreshing: true });
    expect(warnings()).toHaveLength(0);
  });

  it('saving unchanged text sends nothing, starts no run and leaves edit mode', async () => {
    const startRun = vi.fn(async () => undefined);
    const own = vi.fn();
    const { toast } = setup('T-105', { setBody: own }, undefined, { canAutoRun: true, startRun });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Spec markdown' })).toBeNull());
    expect(own).not.toHaveBeenCalled();
    expect(startRun).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });

  it('a Review spec never starts a run, even if a save came back flagged (Review Focus 3)', async () => {
    const startRun = vi.fn(async () => undefined);
    const { toast } = setup('T-103', { setBody }, undefined, { canAutoRun: true, startRun });
    await save(toast);
    expect(startRun).not.toHaveBeenCalled();
  });
});

describe('CardDetail in Simple mode', () => {
  it('full mode shows urgency, categories and the Dependencies section, and no ⋯', () => {
    render(<ReadMode specId="T-105" />);
    expect(screen.getByRole('radiogroup', { name: 'Urgency' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Dependencies' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'More details' })).toBeNull();
  });

  it('Simple mode moves urgency, categories and dependencies into ⋯ More details', () => {
    const onOpenSpec = vi.fn();
    render(<Simple onOpenSpec={onOpenSpec} />);
    expect(screen.queryByRole('radiogroup', { name: 'Urgency' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Dependencies' })).toBeNull();
    expect(screen.queryByText('Backend')).toBeNull();
    // The rest of the detail is unchanged.
    expect(screen.getByRole('heading', { level: 1, name: 'Shopping list export' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Copy run command/ })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'More details' }));
    const menu = within(screen.getByRole('dialog', { name: 'More details' }));
    expect(menu.getByRole('radiogroup', { name: 'Urgency' })).toBeTruthy();
    expect(menu.getByText('Backend')).toBeTruthy();
    expect(menu.getByText('Depends on')).toBeTruthy();
    fireEvent.click(menu.getByRole('button', { name: /T-104/ }));
    expect(onOpenSpec).toHaveBeenCalledWith('T-104');
  });

  it('Esc closes the ⋯ menu before the detail', () => {
    const onClose = vi.fn();
    render(<Simple onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'More details' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'More details' })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('the blocked reason about a dependency opens the ⋯ menu', () => {
    render(<Simple />);
    fireEvent.click(screen.getByRole('button', { name: /Waiting on T-104/ }));
    expect(screen.getByRole('dialog', { name: 'More details' })).toBeTruthy();
  });
});

describe('working in a chat', () => {
  const setupChat = () => {
    const client = { setMeta: vi.fn(async (_pid: string, sid: string) => ({ hash: 'h2', spec: recipeSpec(sid) })) };
    render(
      <WorkingInChat
        pid="p1"
        specId="T-104"
        root={ROOT}
        specs={recipeSpecs}
        archived={recipeArchived}
        client={client as unknown as DetailClient}
        mutate={createMutator(() => Promise.reject(new Error('no default')))}
        refresh={vi.fn(async () => undefined)}
        toast={vi.fn()}
        onMove={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    return client;
  };

  it('shows Not running? Clear; confirming clears current_subtask', async () => {
    const client = setupChat();
    fireEvent.click(screen.getByRole('button', { name: 'Not running? Clear' }));
    expect(client.setMeta).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole('alertdialog', { name: 'Clear the working step?' })).getByRole('button', { name: 'Clear' }));
    await waitFor(() => expect(client.setMeta).toHaveBeenCalledWith('p1', 'T-104', recipeSpec('T-104').hash, 'current_subtask', null));
  });

  it('cancelling writes nothing', async () => {
    const client = setupChat();
    fireEvent.click(screen.getByRole('button', { name: 'Not running? Clear' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep it' }));
    expect(client.setMeta).not.toHaveBeenCalled();
  });
});
