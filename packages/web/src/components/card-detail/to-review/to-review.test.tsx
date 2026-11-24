import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { composeStories } from '@storybook/react-vite';
import type { ReviewItem, Spec } from '@specboard/core';
import { ConflictError } from '@/api/client';
import { recipeSpec } from '@/fixtures/recipeBox';
import { createMutator } from '@/state/mutate';
import { checkSpec } from './check-spec';
import * as stories from './to-review.stories';

const { Default, Checks } = composeStories(stories);

const item = (n: number, text: string, group: string | null, extra: Partial<ReviewItem> = {}): ReviewItem => ({
  n,
  text,
  expected: null,
  steps: [],
  failed: null,
  fixed: [],
  group,
  done: false,
  line: 10 + n,
  ...extra,
});

function setup(sp: Spec, opts: { setReview?: () => Promise<never>; setReviewFailed?: () => Promise<never>; down?: boolean } = {}) {
  const client = {
    setReview: vi.fn(opts.setReview ?? (async (_p: string, id: string) => ({ hash: 'h2', spec: recipeSpec(id) }))),
    setReviewFailed: vi.fn(opts.setReviewFailed ?? (async (_p: string, id: string) => ({ hash: 'h2', spec: recipeSpec(id) }))),
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

const actions = (name: string) => within(screen.getByRole('group', { name: `Check: ${name}` }));

describe('ToReview: How to check', () => {
  it('an item with steps has a collapsed How to check toggle; open, a numbered list', () => {
    setup(checkSpec());
    const toggle = screen.getAllByRole('button', { name: 'How to check' })[0]!;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('npm run dev')).toBeNull();
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const list = document.getElementById(toggle.getAttribute('aria-controls')!)!;
    expect(list.tagName).toBe('OL');
    expect(list.querySelectorAll('li')).toHaveLength(3);
    expect(within(list).getByText('Search').tagName).toBe('STRONG');
  });

  it('the toggle sits at the end of the item row, like Log, and the steps open under the row', () => {
    setup(checkSpec());
    const toggle = screen.getAllByRole('button', { name: 'How to check' })[0]!;
    const item = toggle.closest('[data-review]')!;
    const row = item.firstElementChild!;
    expect(row.lastElementChild).toBe(toggle);
    expect(toggle.querySelectorAll('svg')).toHaveLength(2);
    fireEvent.click(toggle);
    const list = document.getElementById(toggle.getAttribute('aria-controls')!)!;
    expect(row.contains(list)).toBe(false);
    expect(item.contains(list)).toBe(true);
  });

  it('no toggle for an item without steps', () => {
    setup(recipeSpec('T-103'));
    expect(screen.queryByRole('button', { name: 'How to check' })).toBeNull();
  });

  it('http and https links open in a new tab; other links are plain text', () => {
    setup(checkSpec());
    for (const t of screen.getAllByRole('button', { name: 'How to check' })) fireEvent.click(t);
    const link = screen.getByRole('link', { name: 'the recipes page' });
    expect(link.getAttribute('href')).toBe('http://localhost:5173/recipes');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(screen.queryByRole('link', { name: 'this' })).toBeNull();
    expect(screen.getByText('this')).toBeTruthy();
  });

  it('each code span has a copy button that copies its text', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    setup(checkSpec());
    fireEvent.click(screen.getAllByRole('button', { name: 'How to check' })[0]!);
    expect(screen.getByText('npm run dev').tagName).toBe('CODE');
    fireEvent.click(screen.getByRole('button', { name: 'Copy npm run dev' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('npm run dev'));
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeTruthy();
  });
});

describe('ToReview: Pass and Fail', () => {
  it('each unticked item has Pass and Fail; a ticked one has neither and can still be unticked', async () => {
    const { client } = setup(recipeSpec('T-103'));
    expect(actions('Clear the search box').getByRole('button', { name: 'Pass' })).toBeTruthy();
    expect(actions('Clear the search box').getByRole('button', { name: 'Fail' })).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Check: Type a few letters into the search box' })).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Type a few letters into the search box' }));
    await waitFor(() => expect(client.setReview).toHaveBeenCalledWith('p1', 'T-103', 1, expect.any(String), false));
  });

  it('Pass has a green tick and Fail a red X, at regular button size', () => {
    setup(recipeSpec('T-103'));
    const pass = actions('Clear the search box').getByRole('button', { name: 'Pass' });
    const fail = actions('Clear the search box').getByRole('button', { name: 'Fail' });
    expect(pass.querySelector('svg')!.getAttribute('class')).toMatch(/text-done-ink/);
    expect(fail.querySelector('svg')!.getAttribute('class')).toMatch(/text-block-ink/);
    for (const b of [pass, fail]) expect(b.className).toMatch(/h-\[30px\]/);
  });

  it('Pass ticks the item, as the checkbox does', async () => {
    const { client, refresh } = setup(recipeSpec('T-103'));
    fireEvent.click(actions('Clear the search box').getByRole('button', { name: 'Pass' }));
    expect((screen.getByRole('checkbox', { name: 'Clear the search box' }) as HTMLInputElement).checked).toBe(true);
    await waitFor(() => expect(client.setReview).toHaveBeenCalledWith('p1', 'T-103', 2, recipeSpec('T-103').hash, true));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('Fail opens "What went wrong?"; Save is off while empty and sends one line; the item stays unticked', async () => {
    const { client } = setup(recipeSpec('T-103'));
    fireEvent.click(actions('Clear the search box').getByRole('button', { name: 'Fail' }));
    const box = screen.getByLabelText('What went wrong?');
    const save = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    fireEvent.change(box, { target: { value: '   \n ' } });
    expect(save.disabled).toBe(true);
    fireEvent.change(box, { target: { value: 'Nothing\ncomes back ' } });
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    expect(screen.queryByLabelText('What went wrong?')).toBeNull();
    expect((screen.getByRole('checkbox', { name: 'Clear the search box' }) as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText('Failed: Nothing comes back')).toBeTruthy();
    await waitFor(() => expect(client.setReviewFailed).toHaveBeenCalledWith('p1', 'T-103', 2, recipeSpec('T-103').hash, 'Nothing comes back'));
  });

  it('Enter in the box saves; Cancel closes it and saves nothing', async () => {
    const { client } = setup(recipeSpec('T-103'));
    fireEvent.click(actions('Clear the search box').getByRole('button', { name: 'Fail' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('What went wrong?')).toBeNull();
    expect(client.setReviewFailed).not.toHaveBeenCalled();
    fireEvent.click(actions('Clear the search box').getByRole('button', { name: 'Fail' }));
    const box = screen.getByLabelText('What went wrong?');
    fireEvent.change(box, { target: { value: 'Broken' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    await waitFor(() => expect(client.setReviewFailed).toHaveBeenCalledWith('p1', 'T-103', 2, expect.any(String), 'Broken'));
  });

  it('a failed item shows in the block style with its reason, plus Edit and Clear', async () => {
    const { client, view } = setup(checkSpec());
    const row = view.container.querySelector('[data-review="2"]')!;
    expect(row.getAttribute('data-failed')).toBe('true');
    expect(row.className).toMatch(/bg-block-soft/);
    expect(screen.getByText('Failed: The list stays empty until I reload.').className).toMatch(/text-block-ink/);
    expect(screen.getByText('1 failed')).toBeTruthy();
    expect(actions('Clear the search box').queryByRole('button', { name: 'Fail' })).toBeNull();
    fireEvent.click(actions('Clear the search box').getByRole('button', { name: 'Edit' }));
    const box = screen.getByLabelText('What went wrong?') as HTMLTextAreaElement;
    expect(box.value).toBe('The list stays empty until I reload.');
    fireEvent.change(box, { target: { value: 'Still empty' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(client.setReviewFailed).toHaveBeenCalledWith('p1', 'T-103', 2, expect.any(String), 'Still empty'));
  });

  it('Clear removes the reason', async () => {
    const { client } = setup(checkSpec());
    fireEvent.click(actions('Clear the search box').getByRole('button', { name: 'Clear' }));
    expect(screen.queryByText(/^Failed:/)).toBeNull();
    await waitFor(() => expect(client.setReviewFailed).toHaveBeenCalledWith('p1', 'T-103', 2, expect.any(String), null));
  });

  it('shows the fixed history', () => {
    render(<Checks />);
    expect(screen.getByText('Fixed: The filter reset on reload (a1b2c3d)')).toBeTruthy();
  });

  it('a failed save is undone with a toast', async () => {
    const { toast } = setup(recipeSpec('T-103'), { setReviewFailed: () => Promise.reject(new ConflictError('x', 'y')) });
    fireEvent.click(actions('Clear the search box').getByRole('button', { name: 'Fail' }));
    fireEvent.change(screen.getByLabelText('What went wrong?'), { target: { value: 'Broken' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith('err', 'Couldn’t update T-103', 'The file changed. Try again.'));
    await waitFor(() => expect(screen.queryByText('Failed: Broken')).toBeNull());
  });

  it('archived offers no Pass or Fail; offline refuses with a toast', () => {
    setup({ ...checkSpec(), archived: true });
    expect(screen.queryByRole('button', { name: 'Pass' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();
    cleanup();
    const off = setup(checkSpec(), { down: true });
    fireEvent.click(actions('Clear the search box').getByRole('button', { name: 'Clear' }));
    expect(off.client.setReviewFailed).not.toHaveBeenCalled();
    expect(off.toast).toHaveBeenCalled();
  });
});
