import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Spec } from '@specboard/core';
import { ConflictError } from '../../api/client';
import { recipeArchived, recipeSpec, recipeSpecs, fileProblemSpec } from '../../fixtures/recipeBox';
import { createSpecActions, CLAUDE_STUB_TOAST } from '../../state/actions';
import { createMutator } from '../../state/mutate';
import { interceptPop } from '../../lib/popGuard';
import { CardDetail, type DetailClient } from './CardDetail';

const ROOT = 'examples/recipe-box';

function setup(id: string, over: Partial<DetailClient> = {}, specs: Spec[] = [...recipeSpecs, fileProblemSpec]) {
  const client = {
    setMeta: vi.fn(async (_pid: string, sid: string) => ({ hash: 'h2', spec: recipeSpec(sid) })),
    setBody: vi.fn(async (_pid: string, sid: string) => ({ hash: 'h2', spec: recipeSpec(sid) })),
    specDraftCopy: vi.fn(async () => ({ path: '.specboard/specs/T-105-shopping-list-export/spec.draft.md' })),
    setAnswers: vi.fn(async (_pid: string, sid: string) => ({ hash: 'h2', spec: recipeSpec(sid) })),
    setSubtask: vi.fn(async (_pid: string, sid: string) => ({ hash: 'h2', spec: recipeSpec(sid) })),
    claude: vi.fn(async () => ({ stub: true })),
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
  const el = (list: Spec[], down = false) => (
    <CardDetail
      pid="p1"
      specId={id}
      root={ROOT}
      specs={list}
      archived={recipeArchived}
      client={client}
      mutate={mutate}
      refresh={refresh}
      toast={toast}
      onMove={(s, k) => actions.move(s, k)}
      onClose={onClose}
      onOpenSpec={onOpenSpec}
      down={down}
    />
  );
  const r = render(el(specs));
  /** Re-render with this spec replaced by `next` (a live update). */
  const update = (next: Spec) => r.rerender(el(specs.map((x) => (x.id === id ? next : x))));
  return { client, toast, refresh, mutate, onClose, onOpenSpec, update, rerenderWith: (list: Spec[]) => r.rerender(el(list)), rerenderDown: () => r.rerender(el(specs, true)) };
}

const startEdit = (text: string) => {
  fireEvent.click(screen.getByRole('button', { name: '✎ Edit' }));
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

  it('opens archived specs', () => {
    setup('T-100');
    expect(screen.getByRole('dialog', { name: 'Project scaffold' })).toBeTruthy();
  });

  it('status menu marks Current and Approve; picking Done sends status done and toasts approved', async () => {
    const { client, toast } = setup('T-103');
    fireEvent.click(screen.getByRole('button', { name: /Review/ }));
    const menu = screen.getByRole('menu');
    const items = within(menu).getAllByRole('menuitemradio');
    expect(items.map((i) => i.textContent)).toEqual(['○To-do', '◐Doing', '◆ReviewCurrent', '✓DoneApprove']);
    expect(items[2]!.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(items[3]!);
    expect(screen.queryByRole('menu')).toBeNull();
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
    fireEvent.click(screen.getByRole('button', { name: '+ Category' }));
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
    fireEvent.click(screen.getByRole('button', { name: '+ Category' }));
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
      fireEvent.click(screen.getByRole('button', { name: '+ Category' }));
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
    fireEvent.click(screen.getByRole('button', { name: '✎ Edit' }));
    expect(screen.getByText('Markdown · preview on the right')).toBeTruthy();
    const ta = screen.getByRole('textbox', { name: 'Spec markdown' }) as HTMLTextAreaElement;
    expect(ta.value).toBe(recipeSpec('T-104').bodyMd);
    fireEvent.change(ta, { target: { value: 'New **text**' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith('ok', 'Spec saved', '.specboard/specs/T-104-meal-planner-calendar/spec.md'));
    expect(client.setBody).toHaveBeenCalledWith('p1', 'T-104', recipeSpec('T-104').hash, recipeSpec('T-104').bodyHash, 'New **text**');
    expect(screen.queryByRole('textbox', { name: 'Spec markdown' })).toBeNull();
  });

  it('a 409 on save opens the conflict dialog; Reload & keep my copy writes a draft copy', async () => {
    const setBody = vi.fn(async () => {
      throw new ConflictError('h9', 'theirs');
    });
    const { client, toast, refresh } = setup('T-105', { setBody });
    fireEvent.click(screen.getByRole('button', { name: '✎ Edit' }));
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
    fireEvent.click(screen.getByRole('button', { name: '✎ Edit' }));
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
    expect(deps.style.borderColor).toBe('var(--accent)');
    act(() => vi.advanceTimersByTime(1600));
    expect(deps.style.borderColor).toBe('var(--line)');
    fireEvent.click(screen.getByRole('button', { name: /^Awaiting answers on/ }));
    expect((document.querySelector('[data-section="questions"]') as HTMLElement).style.borderColor).toBe('var(--accent)');
  });

  it('no banner when the spec is not blocked', () => {
    setup('T-104');
    expect(screen.queryByText('Blocked.')).toBeNull();
  });

  it('file problem panel shows the problem and path; Ask Claude to fix calls the stub', async () => {
    const { client, toast } = setup('T-109');
    const alert = screen.getByRole('alert');
    expect(within(alert).getByText('This spec file has a formatting problem')).toBeTruthy();
    expect(within(alert).getByText(fileProblemSpec.problems[0]!)).toBeTruthy();
    expect(within(alert).getByText('.specboard/specs/T-109-import-recipes-from-a-file/spec.md')).toBeTruthy();
    fireEvent.click(within(alert).getByRole('button', { name: 'Ask Claude to fix' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith('info', CLAUDE_STUB_TOAST));
    expect(client.claude).toHaveBeenCalledWith('fix-file', { pid: 'p1', id: 'T-109' });
  });

  it('Run calls the Claude stub and shows the stub toast', async () => {
    const { client, toast } = setup('T-104');
    fireEvent.click(screen.getByRole('button', { name: /Tell Claude to start/ }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith('info', CLAUDE_STUB_TOAST));
    expect(client.claude).toHaveBeenCalledWith('run', { pid: 'p1', id: 'T-104' });
  });

  it('Esc closes the innermost layer first: dialog, then category input, then status menu, then modal', async () => {
    const setBody = vi.fn(async () => {
      throw new ConflictError('h9', 'theirs');
    });
    const { onClose } = setup('T-105', { setBody });
    const esc = () => fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

    fireEvent.click(screen.getByRole('button', { name: '+ Category' }));
    expect(screen.getByPlaceholderText('Category…')).toBeTruthy();
    esc();
    expect(screen.queryByPlaceholderText('Category…')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /To-do/ }));
    expect(screen.getByRole('menu')).toBeTruthy();
    esc();
    expect(screen.queryByRole('menu')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '✎ Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('alertdialog');
    esc();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Spec markdown' })).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();

    // No changes: the first Esc closes the editor, the second the modal.
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
      await waitFor(() => expect(toast).toHaveBeenCalledWith('ok', 'Spec saved', expect.any(String)));
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

  describe('Claude actions (Ruling 18)', () => {
    it('while disconnected: offline toast, no API call', () => {
      const { client, toast, rerenderDown } = setup('T-109');
      rerenderDown();
      fireEvent.click(screen.getByRole('button', { name: /Tell Claude to start/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Ask Claude to fix' }));
      expect(client.claude).not.toHaveBeenCalled();
      expect(toast).toHaveBeenCalledTimes(2);
      expect(toast).toHaveBeenCalledWith('err', 'Disconnected from the local server.', 'Edits won’t save until it’s back.');
    });

    it('a real error shows an err toast with its message, not the stub toast', async () => {
      const claude = vi.fn(async () => {
        throw new Error('Server exploded');
      });
      const { toast } = setup('T-104', { claude });
      fireEvent.click(screen.getByRole('button', { name: /Tell Claude to start/ }));
      await waitFor(() => expect(toast).toHaveBeenCalledWith('err', 'Couldn’t reach Claude for T-104', 'Server exploded'));
      expect(toast).not.toHaveBeenCalledWith('info', CLAUDE_STUB_TOAST);
    });

    it('a non-stub success shows no stub toast', async () => {
      const claude = vi.fn(async () => ({ stub: false }));
      const { toast } = setup('T-104', { claude });
      fireEvent.click(screen.getByRole('button', { name: /Tell Claude to start/ }));
      await waitFor(() => expect(claude).toHaveBeenCalled());
      await new Promise((r) => setTimeout(r, 0));
      expect(toast).not.toHaveBeenCalled();
    });
  });

  it('while disconnected, edits show the offline toast and send nothing', () => {
    const client = { setMeta: vi.fn(), setBody: vi.fn(), specDraftCopy: vi.fn(), claude: vi.fn() };
    const toast = vi.fn();
    render(
      <CardDetail
        pid="p1"
        specId="T-104"
        root={ROOT}
        specs={recipeSpecs}
        archived={recipeArchived}
        client={client as unknown as DetailClient}
        mutate={createMutator(() => Promise.reject(new Error('x')))}
        refresh={async () => undefined}
        toast={toast}
        onMove={() => undefined}
        onClose={() => undefined}
        down
      />,
    );
    fireEvent.click(screen.getByRole('radio', { name: /Low/ }));
    expect(client.setMeta).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith('err', 'Disconnected from the local server.', 'Edits won’t save until it’s back.');
  });
});
