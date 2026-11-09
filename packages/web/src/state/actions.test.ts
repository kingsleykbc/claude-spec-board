import { describe, expect, it, vi } from 'vitest';
import { ApiError, ConflictError } from '../api/client';
import { createMutator } from './mutate';
import { createSpecActions, type ActionClient } from './actions';
import { recipeSpec } from '../fixtures/recipeBox';

function setup(client: Partial<ActionClient> = {}) {
  const c: ActionClient = {
    setMeta: vi.fn(async (_pid, id) => ({ hash: 'h2', spec: recipeSpec(id) })),
    archive: vi.fn(async () => undefined),
    unarchive: vi.fn(async () => undefined),
    ...client,
  };
  const mutate = vi.fn(createMutator(() => Promise.reject(new Error('unused'))));
  const refresh = vi.fn(async () => undefined);
  const toast = vi.fn();
  const actions = createSpecActions({ pid: 'p1', client: c, mutate, refresh, toast });
  return { c, mutate, refresh, toast, actions };
}

describe('createSpecActions', () => {
  it('move → meta status through the mutator with the spec hash, then refresh and toast', async () => {
    const { c, mutate, refresh, toast, actions } = setup();
    const t104 = recipeSpec('T-104');
    await actions.move(t104, 'review');
    expect(mutate).toHaveBeenCalledWith('T-104', t104.hash, expect.any(Function));
    expect(c.setMeta).toHaveBeenCalledWith('p1', 'T-104', t104.hash, 'status', 'review');
    expect(refresh).toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith('ok', 'T-104 moved to Review', 'Meal planner calendar');
  });

  it('move to done → approved copy', async () => {
    const { toast, actions } = setup();
    await actions.move(recipeSpec('T-103'), 'done');
    expect(toast).toHaveBeenCalledWith('ok', 'T-103 approved', 'Moved to Done.');
  });

  it('move to the same status does nothing', async () => {
    const { c, actions } = setup();
    await actions.move(recipeSpec('T-104'), 'doing');
    expect(c.setMeta).not.toHaveBeenCalled();
  });

  it('a conflict refreshes and shows the err toast', async () => {
    const { refresh, toast, actions } = setup({ setMeta: vi.fn(async () => Promise.reject(new ConflictError('x', 'y'))) });
    await actions.move(recipeSpec('T-105'), 'doing');
    expect(refresh).toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith('err', 'Couldn’t move T-105', 'The file changed. Try again.');
  });

  it('a conflict on one of 3 queued moves of a spec → exactly one toast and one refresh', async () => {
    const { c, refresh, toast, actions } = setup({ setMeta: vi.fn(async () => Promise.reject(new ConflictError('x', 'y'))) });
    const t105 = recipeSpec('T-105');
    await Promise.all([actions.move(t105, 'doing'), actions.move(t105, 'review'), actions.move(t105, 'done')]);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith('err', 'Couldn’t move T-105', 'The file changed. Try again.');
    // The queued moves are dropped without sending a request that would conflict again.
    expect(c.setMeta).toHaveBeenCalledTimes(1);
  });

  it('a move made after a conflict was handled toasts normally again', async () => {
    const { toast, actions } = setup({ setMeta: vi.fn(async () => Promise.reject(new ConflictError('x', 'y'))) });
    await actions.move(recipeSpec('T-105'), 'doing');
    await actions.move(recipeSpec('T-105'), 'review');
    expect(toast).toHaveBeenCalledTimes(2);
  });

  it('other errors show the message', async () => {
    const { toast, actions } = setup({ setMeta: vi.fn(async () => Promise.reject(new ApiError(400, 'Invalid value for status'))) });
    await actions.move(recipeSpec('T-105'), 'doing');
    expect(toast).toHaveBeenCalledWith('err', 'Couldn’t move T-105', 'Invalid value for status');
  });

  it('archive and unarchive use the prototype copy', async () => {
    const { c, toast, refresh, actions } = setup();
    await actions.archive(recipeSpec('T-101'));
    expect(c.archive).toHaveBeenCalledWith('p1', 'T-101');
    expect(toast).toHaveBeenCalledWith('ok', 'T-101 archived', 'Hidden from the board. Moved to .specboard/archive/.');
    await actions.unarchive(recipeSpec('T-100'));
    expect(c.unarchive).toHaveBeenCalledWith('p1', 'T-100');
    expect(toast).toHaveBeenCalledWith('ok', 'T-100 restored', 'Back on the board.');
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
