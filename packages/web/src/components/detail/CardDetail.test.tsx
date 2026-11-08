import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Spec } from '@specboard/core';
import { ConflictError } from '../../api/client';
import { recipeArchived, recipeSpec, recipeSpecs, fileProblemSpec } from '../../fixtures/recipeBox';
import { createSpecActions, CLAUDE_STUB_TOAST } from '../../state/actions';
import { createMutator } from '../../state/mutate';
import { CardDetail, type DetailClient } from './CardDetail';

const ROOT = 'examples/recipe-box';

function setup(id: string, over: Partial<DetailClient> = {}, specs: Spec[] = [...recipeSpecs, fileProblemSpec]) {
  const client = {
    setMeta: vi.fn(async (_pid: string, sid: string) => ({ hash: 'h2', spec: recipeSpec(sid) })),
    setBody: vi.fn(async (_pid: string, sid: string) => ({ hash: 'h2', spec: recipeSpec(sid) })),
    specDraftCopy: vi.fn(async () => ({ path: '.specboard/specs/T-105-shopping-list-export/spec.draft.md' })),
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
  render(
    <CardDetail
      pid="p1"
      specId={id}
      root={ROOT}
      specs={specs}
      archived={recipeArchived}
      client={client}
      mutate={mutate}
      refresh={refresh}
      toast={toast}
      onMove={(s, k) => actions.move(s, k)}
      onClose={onClose}
    />,
  );
  return { client, toast, refresh, onClose };
}

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

  it('saving an edit sends PATCH body with the hash from when editing began', async () => {
    const { client, toast } = setup('T-104');
    fireEvent.click(screen.getByRole('button', { name: '✎ Edit' }));
    expect(screen.getByText('Markdown · preview on the right')).toBeTruthy();
    const ta = screen.getByRole('textbox', { name: 'Spec markdown' }) as HTMLTextAreaElement;
    expect(ta.value).toBe(recipeSpec('T-104').bodyMd);
    fireEvent.change(ta, { target: { value: 'New **text**' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith('ok', 'Spec saved', '.specboard/specs/T-104-meal-planner-calendar/spec.md'));
    expect(client.setBody).toHaveBeenCalledWith('p1', 'T-104', recipeSpec('T-104').hash, 'New **text**');
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

    esc();
    expect(onClose).toHaveBeenCalledTimes(1);
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
