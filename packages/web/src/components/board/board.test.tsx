import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { composeStories } from '@storybook/react-vite';
import * as stories from './board.stories';
import { recipeSpecs } from '@/fixtures/recipeBox';
import { NO_FILTERS } from '@/state/filters';

const { Populated, MilestoneBasics, MilestonePlanning, BlockedOnly, EmptyProject } = composeStories(stories);

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

type Props = Parameters<typeof Populated>[0];

function setup(props: Props = {}, Story: typeof Populated = Populated) {
  const fns = { onMove: vi.fn(), onOpen: vi.fn(), onArchive: vi.fn(), onUnarchive: vi.fn(), onWriteUp: vi.fn(), onAdd: vi.fn() };
  render(<Story {...fns} {...props} />);
  return fns;
}
const col = (label: string) => screen.getByRole('region', { name: label });
const card = (id: string) => screen.getByRole('button', { name: new RegExp(`^${id} `) });

/** Press on an element, move past the 4 px threshold, then over `x`, and release. */
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

/** Space, then each arrow key, then Space, on a focused card (dnd-kit's keyboard sensor). */
async function keyboardDrag(el: HTMLElement, ...arrows: string[]) {
  el.focus();
  act(() => {
    fireEvent.keyDown(el, { code: 'Space', key: ' ' });
  });
  // dnd-kit attaches its keydown listener on the next tick.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  expect(el.getAttribute('aria-pressed')).toBe('true');
  for (const a of arrows) {
    act(() => {
      fireEvent.keyDown(el, { code: a, key: a });
    });
  }
  act(() => {
    fireEvent.keyDown(el, { code: 'Space', key: ' ' });
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

  it('on the Basics milestone, Show archived (1) shows "Project scaffold"', () => {
    setup({}, MilestoneBasics);
    const done = within(col('Done'));
    expect(done.queryByText('Project scaffold')).toBeNull();
    fireEvent.click(done.getByRole('button', { name: 'Show archived (1)' }));
    expect(done.getByText('Project scaffold')).toBeTruthy();
    expect(done.getByRole('button', { name: 'Hide archived (1)' })).toBeTruthy();
  });

  it('on the Planning milestone, no archived spec is in it, so there is no toggle', () => {
    setup({}, MilestonePlanning);
    expect(within(col('Done')).queryByRole('button', { name: /archived/ })).toBeNull();
  });

  it('Blocked only does not hide archived specs from the count', () => {
    setup({}, BlockedOnly);
    const done = within(col('Done'));
    fireEvent.click(done.getByRole('button', { name: 'Show archived (1)' }));
    expect(done.getByText('Project scaffold')).toBeTruthy();
  });

  it('shows the per-column empty text', () => {
    setup({ specs: recipeSpecs.filter((s) => s.status === 'todo'), archived: [] });
    expect(within(col('Doing')).getByText('Nothing in progress')).toBeTruthy();
    expect(within(col('Review')).getByText('Nothing waiting on you')).toBeTruthy();
    expect(within(col('Done')).getByText('Nothing done yet')).toBeTruthy();
    cleanup();
    setup({}, EmptyProject);
    expect(screen.getAllByText('Nothing to do').length).toBeGreaterThan(0);
  });

  it('shows the empty board state when the project has no specs', () => {
    const fns = setup({}, EmptyProject);
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
    // The column under the card: accent background and a dashed accent outline.
    expect(review.getAttribute('data-over')).toBe('true');
    expect(review.className).toMatch(/\boutline-dashed\b/);
    expect(review.className).toMatch(/\boutline-accent\b/);
    expect(review.className).toMatch(/\bbg-accent-soft\b/);
    expect(col('Doing').getAttribute('data-over')).toBeNull();
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
    expect(card('T-105').getAttribute('data-flash')).toBe('true');
    expect(card('T-105').className).toMatch(/\bbg-accent-soft\b/);
    expect(card('T-106').getAttribute('data-flash')).toBeNull();
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

describe('Board: cards with indicators still drag and open (review focus 2)', () => {
  it('T-105 (Blocked, an info popover): Space, ArrowRight, Space moves it To-do → Doing', async () => {
    const fns = setup();
    const c = card('T-105');
    expect(within(c).getByRole('button', { name: 'Why is T-105 blocked?' })).toBeTruthy();
    await keyboardDrag(c, 'ArrowRight');
    expect(fns.onMove).toHaveBeenCalledTimes(1);
    expect(fns.onMove.mock.calls[0]![0]).toMatchObject({ id: 'T-105', status: 'todo' });
    expect(fns.onMove.mock.calls[0]![1]).toBe('doing');
    expect(fns.onOpen).not.toHaveBeenCalled();
  });

  it('T-101 (the ⋯ button has a hint): Space, ArrowLeft, Space moves it Done → Review', async () => {
    const fns = setup();
    const c = card('T-101');
    expect(within(c).getByRole('button', { name: 'Card actions' })).toBeTruthy();
    await keyboardDrag(c, 'ArrowLeft');
    expect(fns.onMove).toHaveBeenCalledTimes(1);
    expect(fns.onMove.mock.calls[0]![1]).toBe('review');
    expect(fns.onOpen).not.toHaveBeenCalled();
  });

  it('clicking a card with an indicator opens it; clicking the indicator does not', async () => {
    const fns = setup();
    const blocked = within(card('T-105')).getByRole('button', { name: 'Why is T-105 blocked?' });
    fireEvent.click(blocked);
    expect(fns.onOpen).not.toHaveBeenCalled();
    expect(await screen.findByRole('dialog', { name: 'Blocked' })).toBeTruthy();
    fireEvent.click(screen.getByText('3 open questions · Waiting on T-104 (doing)'));
    expect(fns.onOpen).not.toHaveBeenCalled();
    fireEvent.click(card('T-105'));
    expect(fns.onOpen).toHaveBeenCalledWith('T-105');
  });

  it('pressing on the indicator and moving does not start a drag', () => {
    const fns = setup();
    drag(within(card('T-105')).getByRole('button', { name: 'Why is T-105 blocked?' }), 300 + 100);
    expect(screen.queryByText('Drop to move to Doing')).toBeNull();
    expect(fns.onMove).not.toHaveBeenCalled();
  });

  it('Space on the indicator does not pick the card up or open it', async () => {
    const fns = setup();
    const blocked = within(card('T-105')).getByRole('button', { name: 'Why is T-105 blocked?' });
    blocked.focus();
    act(() => {
      fireEvent.keyDown(blocked, { code: 'Space', key: ' ' });
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(card('T-105').getAttribute('aria-pressed')).not.toBe('true');
    expect(fns.onOpen).not.toHaveBeenCalled();
  });
});

describe('Board: the archived toggle folds away when nothing archived matches', () => {
  it('Basics, open archived, Planning (none), back to Basics: the archived cards are folded again', () => {
    const fns = { onMove: vi.fn(), onOpen: vi.fn(), onArchive: vi.fn(), onUnarchive: vi.fn(), onWriteUp: vi.fn(), onAdd: vi.fn() };
    const basics = { ...NO_FILTERS, milestone: 'Basics' };
    const { rerender } = render(<MilestoneBasics {...fns} filters={basics} />);
    fireEvent.click(within(col('Done')).getByRole('button', { name: 'Show archived (1)' }));
    expect(within(col('Done')).getByText('Project scaffold')).toBeTruthy();
    rerender(<MilestoneBasics {...fns} filters={{ ...NO_FILTERS, milestone: 'Planning' }} />);
    expect(within(col('Done')).queryByRole('button', { name: /archived/ })).toBeNull();
    rerender(<MilestoneBasics {...fns} filters={basics} />);
    expect(within(col('Done')).getByRole('button', { name: 'Show archived (1)' })).toBeTruthy();
    expect(within(col('Done')).queryByText('Project scaffold')).toBeNull();
  });
});
