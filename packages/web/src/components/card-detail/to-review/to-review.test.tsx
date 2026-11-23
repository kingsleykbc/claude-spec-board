import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { composeStories } from '@storybook/react-vite';
import type { ReviewItem, Spec } from '@specboard/core';
import { ConflictError } from '@/api/client';
import { recipeSpec } from '@/fixtures/recipeBox';
import { createMutator } from '@/state/mutate';
import * as stories from './to-review.stories';

const { Default } = composeStories(stories);

const item = (n: number, text: string, group: string | null, extra: Partial<ReviewItem> = {}): ReviewItem => ({ n, text, expected: null, group, done: false, line: 10 + n, ...extra });

function setup(sp: Spec, opts: { setReview?: () => Promise<never>; down?: boolean } = {}) {
  const client = {
    setReview: vi.fn(opts.setReview ?? (async (_p: string, id: string) => ({ hash: 'h2', spec: recipeSpec(id) }))),
  };
  const toast = vi.fn();
  const refresh = vi.fn(async () => undefined);
  const mutate = createMutator(() => Promise.reject(new Error('no default')));
  const view = render(<Default pid="p1" spec={sp} client={client as never} mutate={mutate} refresh={refresh} toast={toast} down={opts.down ?? false} />);
  return { client, toast, refresh, view };
}

afterEach(cleanup);

describe('ToReview', () => {
  it('renders items under their group heading with expected text, and the count', () => {
    setup(recipeSpec('T-103'));
    expect(screen.getByText('TO REVIEW')).toBeTruthy();
    expect(screen.getByText('1 of 3 checked')).toBeTruthy();
    const searching = screen.getByRole('group', { name: 'Searching' });
    expect(within(searching).getAllByRole('checkbox')).toHaveLength(2);
    expect(within(searching).getByText('Expected: All recipes come back.')).toBeTruthy();
    expect(within(screen.getByRole('group', { name: 'Filters' })).getAllByRole('checkbox')).toHaveLength(1);
    expect((screen.getByRole('checkbox', { name: 'Type a few letters into the search box' }) as HTMLInputElement).checked).toBe(true);
  });

  it('puts ungrouped items first with no heading and omits expected when absent', () => {
    const sp = { ...recipeSpec('T-103'), reviews: [item(1, 'Plain check', null), item(2, 'Grouped check', 'Later')] };
    setup(sp);
    expect(screen.queryByText(/Expected:/)).toBeNull();
    expect(screen.getAllByRole('checkbox')[0]).toBe(screen.getByRole('checkbox', { name: 'Plain check' }));
    expect(screen.getAllByRole('heading')).toHaveLength(1);
  });

  it('renders nothing when there are no items', () => {
    const { view } = setup({ ...recipeSpec('T-103'), reviews: [] });
    expect(view.container.querySelector('[data-section="to-review"]')).toBeNull();
  });

  it('ticking calls the API with n, the hash and done, then refreshes', async () => {
    const { client, refresh } = setup(recipeSpec('T-103'));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Clear the search box' }));
    expect((screen.getByRole('checkbox', { name: 'Clear the search box' }) as HTMLInputElement).checked).toBe(true);
    await waitFor(() => expect(client.setReview).toHaveBeenCalledWith('p1', 'T-103', 2, recipeSpec('T-103').hash, true));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('unticking sends done false', async () => {
    const { client } = setup(recipeSpec('T-103'));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Type a few letters into the search box' }));
    await waitFor(() => expect(client.setReview).toHaveBeenCalledWith('p1', 'T-103', 1, expect.any(String), false));
  });

  it('a conflict reverts the tick and says the file changed', async () => {
    const { toast } = setup(recipeSpec('T-103'), { setReview: () => Promise.reject(new ConflictError('x', 'y')) });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Clear the search box' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith('err', 'Couldn’t update T-103', 'The file changed. Try again.'));
    await waitFor(() => expect((screen.getByRole('checkbox', { name: 'Clear the search box' }) as HTMLInputElement).checked).toBe(false));
  });

  it('is read-only for an archived spec', () => {
    const { client } = setup({ ...recipeSpec('T-103'), archived: true });
    const box = screen.getByRole('checkbox', { name: 'Clear the search box' }) as HTMLInputElement;
    expect(box.disabled).toBe(true);
    fireEvent.click(box);
    expect(client.setReview).not.toHaveBeenCalled();
  });

  it('offline: toasts and does not call the API', () => {
    const { client, toast } = setup(recipeSpec('T-103'), { down: true });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Clear the search box' }));
    expect(client.setReview).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalled();
  });
});
