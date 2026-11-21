import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { composeStories } from '@storybook/react-vite';
import type { Spec } from '@specboard/core';
import { ConflictError } from '@/api/client';
import { recipeSpec } from '@/fixtures/recipeBox';
import { createMutator } from '@/state/mutate';
import type { SubtaskClient } from './subtasks';
import * as stories from './subtasks.stories';

const { Default } = composeStories(stories);

interface Opts {
  setSubtask?: SubtaskClient['setSubtask'];
  changed?: Set<string>;
  runActive?: boolean;
  chat?: number | null;
  down?: boolean;
}

function setup(sp: Spec, opts: Opts = {}) {
  let n = 0;
  const client = {
    setSubtask: vi.fn(
      opts.setSubtask ??
        (async (_p: string, id: string) => {
          await new Promise((r) => setTimeout(r, 5));
          return { hash: `h${++n}`, spec: recipeSpec(id) };
        }),
    ),
  };
  const toast = vi.fn();
  const refresh = vi.fn(async () => undefined);
  const mutate = createMutator(() => Promise.reject(new Error('no default')));
  render(
    <Default
      pid="p1"
      spec={sp}
      client={client}
      mutate={mutate}
      refresh={refresh}
      toast={toast}
      down={opts.down ?? false}
      changed={opts.changed ?? new Set()}
      runActive={opts.runActive ?? false}
      chat={opts.chat ?? null}
    />,
  );
  return { client, toast, refresh };
}

const box = (name: string) => screen.getByRole('checkbox', { name }) as HTMLInputElement;
const row = (n: number) => document.querySelector(`[data-subtask="${n}"]`) as HTMLElement;

afterEach(cleanup);

describe('Subtasks', () => {
  it('header shows "<d> of <n> done" and a bar; rows show title and done state', () => {
    setup(recipeSpec('T-104'));
    expect(screen.getByText('SUBTASKS')).toBeTruthy();
    expect(screen.getByText('2 of 5 done')).toBeTruthy();
    const bar = screen.getByTestId('subtask-bar');
    expect(bar.style.width).toBe('40%');
    expect(bar.getAttribute('data-complete')).toBe('false');
    expect(box('Create calendar grid').checked).toBe(true);
    expect(box('Persist planned meals').checked).toBe(false);
  });

  it('the bar turns green when all are done', () => {
    setup(recipeSpec('T-101'));
    expect(screen.getByTestId('subtask-bar').getAttribute('data-complete')).toBe('true');
  });

  it('empty copy when there are no subtasks', () => {
    setup({ ...recipeSpec('T-104'), subtasks: [], logs: {} });
    expect(screen.getByText('No subtasks yet. Claude adds them when it writes up the spec.')).toBeTruthy();
  });

  it('ticking subtasks 3, 4 and 5 quickly sends three PATCHes in order, each with the previous hash (Review Focus 3)', async () => {
    const sp = recipeSpec('T-104');
    const { client, refresh } = setup(sp);
    fireEvent.click(box('Persist planned meals'));
    fireEvent.click(box('Week navigation'));
    fireEvent.click(box('Empty-day state'));
    // Optimistic ticks.
    expect([3, 4, 5].map((n) => (within(row(n)).getByRole('checkbox') as HTMLInputElement).checked)).toEqual([true, true, true]);
    await waitFor(() => expect(client.setSubtask).toHaveBeenCalledTimes(3));
    expect(client.setSubtask.mock.calls).toEqual([
      ['p1', 'T-104', 3, sp.hash, true],
      ['p1', 'T-104', 4, 'h1', true],
      ['p1', 'T-104', 5, 'h2', true],
    ]);
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('a failed tick reverts and shows an err toast', async () => {
    const { toast, refresh } = setup(recipeSpec('T-104'), {
      setSubtask: async () => {
        throw new ConflictError('h9', 'theirs');
      },
    });
    fireEvent.click(box('Week navigation'));
    expect(box('Week navigation').checked).toBe(true);
    await waitFor(() => expect(toast).toHaveBeenCalledWith('err', 'Couldn’t update T-104', 'The file changed. Try again.'));
    expect(refresh).toHaveBeenCalled();
    expect(box('Week navigation').checked).toBe(false);
  });

  it('while disconnected a tick shows the offline toast and sends nothing', () => {
    const { client, toast } = setup(recipeSpec('T-104'), { down: true });
    fireEvent.click(box('Week navigation'));
    expect(client.setSubtask).not.toHaveBeenCalled();
    expect(box('Week navigation').checked).toBe(false);
    expect(toast).toHaveBeenCalledWith('err', 'Disconnected from the local server.', 'Edits won’t save until it’s back.');
  });

  it('In progress shows on currentSubtask only while a run is active', () => {
    setup(recipeSpec('T-104'));
    expect(screen.queryByText('In progress')).toBeNull();
    cleanup();
    setup(recipeSpec('T-104'), { runActive: true });
    expect(within(row(3)).getByText('In progress')).toBeTruthy();
    expect(screen.getAllByText('In progress')).toHaveLength(1);
  });

  it('In progress shows on the chat step, as for a background run', () => {
    setup(recipeSpec('T-104'), { chat: 2 });
    expect(within(row(2)).getByText('In progress')).toBeTruthy();
    expect(screen.getAllByText('In progress')).toHaveLength(1);
  });

  it('rows changed by a live update flash accent-soft', () => {
    setup(recipeSpec('T-104'), { changed: new Set(['T-104', 'T-104:2', 'T-105:3']) });
    expect(row(2).getAttribute('data-changed')).toBe('true');
    expect(row(3).getAttribute('data-changed')).toBe('false');
  });

  it('Log toggles the inline log, one open at a time', () => {
    setup(recipeSpec('T-104'));
    const logs = screen.getAllByRole('button', { name: /Log/ });
    expect(logs).toHaveLength(2); // only subtasks 1 and 2 have logs
    expect(logs[0]!.textContent).toBe('Log');
    fireEvent.click(logs[0]!);
    expect(logs[0]!.getAttribute('aria-expanded')).toBe('true');
    expect(within(row(1)).getByText('LOG · READ ONLY')).toBeTruthy();
    fireEvent.click(logs[1]!);
    expect(within(row(1)).queryByText('LOG · READ ONLY')).toBeNull();
    expect(within(row(2)).getByText('LOG · READ ONLY')).toBeTruthy();
    fireEvent.click(logs[1]!);
    expect(screen.queryByText('LOG · READ ONLY')).toBeNull();
  });

  it('T-104 subtask 1’s log shows Nov 7 times, the files and the commit', () => {
    setup(recipeSpec('T-104'));
    fireEvent.click(within(row(1)).getByRole('button', { name: /Log/ }));
    const r = within(row(1));
    expect(r.getByText('Nov 7, 15:12')).toBeTruthy();
    expect(r.getByText('Nov 7, 15:31')).toBeTruthy();
    expect(r.getByText('Added a WeekGrid component with seven day columns and breakfast, lunch and dinner rows.')).toBeTruthy();
    expect(r.getByText('FILES CHANGED')).toBeTruthy();
    for (const f of ['src/components/WeekGrid.tsx', 'src/components/WeekGrid.test.tsx', 'src/pages/Planner.tsx']) expect(r.getByText(f)).toBeTruthy();
    expect(r.getByText('COMMIT')).toBeTruthy();
    expect(r.getByText('4f2a91c')).toBeTruthy();
  });

  it('a spec without logs (or a missing logs map) shows no Log button and does not crash', () => {
    const sp = recipeSpec('T-104');
    setup({ ...sp, logs: undefined as unknown as Spec['logs'] });
    expect(screen.queryByRole('button', { name: /Log/ })).toBeNull();
  });

  it('a (you) subtask shows a "you" tag and its text without the prefix', () => {
    const sp = recipeSpec('T-104');
    setup({
      ...sp,
      subtasks: [
        { n: 1, title: '(you) Add the design', done: false, line: 0, hasLog: false },
        { n: 2, title: 'Build it', done: false, line: 0, hasLog: false },
      ],
    });
    expect(screen.getByText('Add the design')).toBeTruthy();
    expect(screen.queryByText('(you) Add the design')).toBeNull();
    const tags = screen.getAllByTestId('you-tag');
    expect(tags).toHaveLength(1);
    expect(tags[0]!.textContent).toBe('you');
    expect(row(1).contains(tags[0]!)).toBe(true);
    expect(screen.getByLabelText(/Add the design/)).toBeTruthy();
  });
});

