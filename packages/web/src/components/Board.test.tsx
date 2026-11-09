import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Board, type BoardProps } from './Board';
import { recipeArchived, recipeSpecs } from '../fixtures/recipeBox';

// happy-dom has no layout: give each column a box side by side (300 px wide), and each card a box inside its column.
const COLS = ['To-do', 'Doing', 'Review', 'Done'];
function rectFor(el: Element): DOMRect {
  const section = el.closest('section[aria-label]');
  const i = section ? COLS.indexOf(section.getAttribute('aria-label')!) : -1;
  if (i < 0) {
    // The DragOverlay starts where its source card is.
    const lifted = el.matches('[aria-label^="T-"]') ? el : el.querySelector('[aria-label^="T-"]');
    const src = lifted && [...document.querySelectorAll('section [aria-label^="T-"]')].find((x) => x.getAttribute('aria-label') === lifted.getAttribute('aria-label'));
    return src ? rectFor(src) : new DOMRect(0, 0, 0, 0);
  }
  if (el === section) return new DOMRect(i * 300, 0, 280, 800);
  return new DOMRect(i * 300 + 10, 50, 260, 100);
}

beforeEach(() => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    return rectFor(this);
  });
});
afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  // dnd-kit swallows clicks for 50 ms after a drop (its capture listener on document); let it go.
  await new Promise((r) => setTimeout(r, 60));
});

function setup(props: Partial<BoardProps> = {}) {
  const fns = { onMove: vi.fn(), onOpen: vi.fn(), onArchive: vi.fn(), onUnarchive: vi.fn(), onWriteUp: vi.fn(), onAdd: vi.fn() };
  render(<Board specs={recipeSpecs} archived={recipeArchived} canDrag {...fns} {...props} />);
  return fns;
}
const col = (label: string) => screen.getByRole('region', { name: label });
const card = (id: string) => screen.getByRole('button', { name: new RegExp(`^${id} `) });

/** Press on a card, move past the 4 px threshold, then over `x`, and release. */
function drag(el: HTMLElement, x: number, y = 300) {
  const opts = { isPrimary: true, button: 0, pointerId: 1, bubbles: true };
  act(() => {
    fireEvent.pointerDown(el, { ...opts, clientX: 40, clientY: 80 });
  });
  act(() => {
    fireEvent.pointerMove(document, { ...opts, clientX: 50, clientY: 90 });
  });
  act(() => {
    fireEvent.pointerMove(document, { ...opts, clientX: x, clientY: y });
  });
  act(() => {
    fireEvent.pointerUp(document, { ...opts, clientX: x, clientY: y });
  });
}

describe('Board', () => {
  it('lays out four columns with counts, sorted cards and the Review label', () => {
    setup();
    const todo = within(col('To-do'));
    expect(todo.getByText('4')).toBeTruthy();
    const order = todo.getAllByRole('button', { name: /^T-\d+ / }).map((b) => b.getAttribute('aria-label')!.split(' ')[0]);
    expect(order).toEqual(['T-106', 'T-105', 'T-108', 'T-107']);
    expect(within(col('Review')).getByText('Needs you')).toBeTruthy();
    expect(within(col('Doing')).queryByText('Needs you')).toBeNull();
  });

  it('the Done column shows Show archived (1), and clicking it shows T-100', () => {
    setup();
    const done = within(col('Done'));
    expect(done.queryByRole('button', { name: /^T-100 / })).toBeNull();
    fireEvent.click(done.getByRole('button', { name: 'Show archived (1)' }));
    expect(done.getByRole('button', { name: /^T-100 / })).toBeTruthy();
    expect(done.getByRole('button', { name: 'Hide archived (1)' })).toBeTruthy();
    expect(done.getByText('3')).toBeTruthy();
  });

  it('shows the per-column empty text', () => {
    setup({ specs: recipeSpecs.filter((s) => s.status === 'todo'), archived: [] });
    expect(within(col('Doing')).getByText('Nothing in progress')).toBeTruthy();
    expect(within(col('Review')).getByText('Nothing waiting on you')).toBeTruthy();
    expect(within(col('Done')).getByText('Nothing done yet')).toBeTruthy();
    setup({ specs: [], archived: [] });
    expect(screen.getAllByText('Nothing to do').length).toBeGreaterThan(0);
  });

  it('shows the empty board state when the project has no specs', () => {
    const fns = setup({ specs: [], archived: [] });
    expect(screen.getByText('No specs yet')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Add new spec' })[0]!);
    expect(fns.onAdd).toHaveBeenCalled();
  });

  it('a drop on Review calls onMove with status review', () => {
    const fns = setup();
    drag(card('T-104'), 2 * 300 + 100);
    expect(fns.onMove).toHaveBeenCalledTimes(1);
    expect(fns.onMove.mock.calls[0]![0].id).toBe('T-104');
    expect(fns.onMove.mock.calls[0]![1]).toBe('review');
  });

  it('a drop back on its own column does nothing', () => {
    const fns = setup();
    drag(card('T-104'), 300 + 100);
    expect(fns.onMove).not.toHaveBeenCalled();
  });

  it('shows the drop placeholder in sort order while over another column', () => {
    setup();
    const opts = { isPrimary: true, button: 0, pointerId: 1, bubbles: true };
    act(() => {
      fireEvent.pointerDown(card('T-106'), { ...opts, clientX: 40, clientY: 80 });
    });
    act(() => {
      fireEvent.pointerMove(document, { ...opts, clientX: 50, clientY: 90 });
    });
    act(() => {
      fireEvent.pointerMove(document, { ...opts, clientX: 2 * 300 + 100, clientY: 300 });
    });
    const review = col('Review');
    const ph = within(review).getByText('Drop to move to Review');
    // T-106 is urgent: it lands before T-103 (high).
    const t103 = within(review).getByRole('button', { name: /^T-103 / });
    expect(ph.compareDocumentPosition(t103) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(review.style.outlineStyle).toBe('dashed');
    expect(review.style.outlineColor).toBe('var(--accent)');
    expect(review.style.background).toBe('var(--accent-soft)');
    act(() => {
      fireEvent.pointerUp(document, { ...opts, clientX: 2 * 300 + 100, clientY: 300 });
    });
    expect(screen.queryByText('Drop to move to Review')).toBeNull();
  });

  it('while disconnected, dragging is disabled', () => {
    const fns = setup({ canDrag: false });
    expect(card('T-104').getAttribute('aria-disabled')).toBe('true');
    drag(card('T-104'), 2 * 300 + 100);
    expect(fns.onMove).not.toHaveBeenCalled();
  });

  it('archived cards are not draggable', () => {
    const fns = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Show archived (1)' }));
    expect(card('T-100').getAttribute('aria-disabled')).toBe('true');
    drag(card('T-100'), 100);
    expect(fns.onMove).not.toHaveBeenCalled();
  });

  it('flashes changed cards and opens on click', () => {
    const fns = setup({ changed: new Set(['T-105']) });
    expect(card('T-105').style.background).toBe('var(--accent-soft)');
    expect(card('T-106').style.background).toBe('');
    fireEvent.click(card('T-106'));
    expect(fns.onOpen).toHaveBeenCalledWith('T-106');
  });

  it('keyboard drag: Space, ArrowRight, Space moves Doing → Review without opening the card', async () => {
    const fns = setup();
    const c = card('T-104');
    c.focus();
    act(() => {
      fireEvent.keyDown(c, { code: 'Space', key: ' ' });
    });
    // dnd-kit attaches its keydown listener on the next tick.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(c.getAttribute('aria-pressed')).toBe('true');
    act(() => {
      fireEvent.keyDown(c, { code: 'ArrowRight', key: 'ArrowRight' });
    });
    expect(screen.getByText('Drop to move to Review')).toBeTruthy();
    act(() => {
      fireEvent.keyDown(c, { code: 'Space', key: ' ' });
    });
    expect(fns.onMove).toHaveBeenCalledTimes(1);
    expect(fns.onMove.mock.calls[0]![0]).toMatchObject({ id: 'T-104', status: 'doing' });
    expect(fns.onMove.mock.calls[0]![1]).toBe('review');
    expect(fns.onOpen).not.toHaveBeenCalled();
  });

  it('a plain Enter on a card that is not being dragged still opens it', () => {
    const fns = setup();
    fireEvent.keyDown(card('T-104'), { code: 'Enter', key: 'Enter' });
    expect(fns.onOpen).toHaveBeenCalledWith('T-104');
    expect(fns.onMove).not.toHaveBeenCalled();
  });
});
