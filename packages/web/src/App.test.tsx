import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Project } from '@specboard/core';
import { recipeArchived, recipeSpecs } from './fixtures/recipeBox';
import type { Conn } from './api/live';

const live = vi.hoisted(() => ({ onConn: null as null | ((c: Conn) => void), calls: 0 }));
vi.mock('./api/live', () => ({
  connectLive: (_pid: string, _onChange: () => void, onConn: (c: Conn) => void) => {
    live.onConn = onConn;
    live.calls += 1;
    return () => undefined;
  },
}));

const project = (name: string, specs = recipeSpecs, archived = recipeArchived): Project => ({
  root: `/x/${name}`,
  config: { name, description: '', references: [] } as unknown as Project['config'],
  overview: null,
  specs,
  archived,
  problems: [],
});

vi.mock('./api/client', async (orig) => {
  const real = await orig<typeof import('./api/client')>();
  return {
    ...real,
    api: {
      projects: vi.fn(async () => [
        { id: 'p1', name: 'Recipe Box', root: '/x/recipe-box', progress: { done: 3, total: 9 } },
        { id: 'p2', name: 'Empty', root: '/x/empty', progress: { done: 0, total: 0 } },
      ]),
      project: vi.fn(async (pid: string) =>
        pid === 'p1'
          ? { entry: { id: 'p1', name: 'Recipe Box', root: '/x/recipe-box' }, project: project('Recipe Box'), nextId: 'T-109' }
          : { entry: { id: 'p2', name: 'Empty', root: '/x/empty' }, project: project('Empty', [], []), nextId: 'T-101' },
      ),
      setMeta: vi.fn(async (_pid: string, id: string) => ({ hash: 'h2', spec: recipeSpecs.find((s) => s.id === id) })),
      archive: vi.fn(async () => undefined),
      unarchive: vi.fn(async () => undefined),
      claude: vi.fn(async () => ({ stub: true })),
    },
  };
});

import { App } from './App';
import { api } from './api/client';

const COLS = ['To-do', 'Doing', 'Review', 'Done'];
beforeEach(() => {
  history.replaceState(null, '', '/');
  try {
    localStorage.clear();
  } catch {
    // ignore
  }
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const section = this.closest('section[aria-label]');
    const i = section ? COLS.indexOf(section.getAttribute('aria-label')!) : -1;
    if (i < 0) return new DOMRect(0, 0, 0, 0);
    return this === section ? new DOMRect(i * 300, 0, 280, 800) : new DOMRect(i * 300 + 10, 50, 260, 100);
  });
});
afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  vi.mocked(api.setMeta).mockReset(); // back to the factory implementation
  await new Promise((r) => setTimeout(r, 60));
});

const board = async () => screen.findByRole('region', { name: 'Review' });

describe('App', () => {
  it('defaults to the first project and writes ?project= into the URL', async () => {
    render(<App />);
    await board();
    expect(location.search).toBe('?project=p1');
    expect(screen.getByRole('button', { name: /Recipe Box/ }).textContent).toContain('3/9 done');
    expect(screen.getByText('1 to review')).toBeTruthy();
  });

  it('reads ?project= and switches projects through the switcher, resetting filters', async () => {
    history.replaceState(null, '', '/?project=p1');
    render(<App />);
    await board();
    fireEvent.click(screen.getByRole('switch', { name: 'Blocked only' }));
    expect(screen.getByRole('switch', { name: 'Blocked only' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /Recipe Box/ }));
    const menu = screen.getByRole('menu');
    fireEvent.click(within(menu).getByRole('menuitemradio', { name: /Empty/ }));
    await screen.findByText('No specs yet', { selector: 'div' });
    expect(location.search).toBe('?project=p2');
    expect(screen.getByRole('switch', { name: 'Blocked only' }).getAttribute('aria-checked')).toBe('false');
    // Back button: the browser restores the URL, then fires popstate.
    act(() => {
      history.replaceState(null, '', '/?project=p1');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await screen.findByText('1 to review');
  });

  it('opening a card sets ?spec=, and popstate follows the URL', async () => {
    render(<App />);
    await board();
    fireEvent.click(screen.getByRole('button', { name: /^T-106 / }));
    expect(location.search).toBe('?project=p1&spec=T-106');
    fireEvent.click(screen.getByText('3 questions for you'));
    expect(location.search).toBe('?project=p1&spec=T-105');
  });

  it('two quick moves of one spec: the card stays in the second target until its refresh', async () => {
    const pendings: (() => void)[] = [];
    vi.mocked(api.setMeta).mockImplementation(
      (_pid, id) =>
        new Promise((res) => {
          pendings.push(() => res({ hash: `h${pendings.length}`, spec: recipeSpecs.find((s) => s.id === id)! }));
        }),
    );
    render(<App />);
    await board();
    const o = { isPrimary: true, button: 0, pointerId: 1, bubbles: true };
    const dragTo = async (x: number) => {
      const card = screen.getByRole('button', { name: /^T-104 / });
      act(() => void fireEvent.pointerDown(card, { ...o, clientX: 40, clientY: 80 }));
      act(() => void fireEvent.pointerMove(document, { ...o, clientX: 50, clientY: 90 }));
      act(() => void fireEvent.pointerMove(document, { ...o, clientX: x, clientY: 300 }));
      act(() => void fireEvent.pointerUp(document, { ...o, clientX: x, clientY: 300 }));
      await act(async () => {
        await new Promise((r) => setTimeout(r, 60));
      });
    };
    const colOf = () => screen.getByRole('button', { name: /^T-104 / }).closest('section')!.getAttribute('aria-label');
    await dragTo(700); // → Review (first move in flight)
    expect(colOf()).toBe('Review');
    await dragTo(1000); // → Done (queued behind the first)
    expect(colOf()).toBe('Done');
    // The first move finishes (and refreshes); the second is still in flight.
    await act(async () => pendings[0]!());
    await screen.findByText('T-104 moved to Review');
    expect(colOf()).toBe('Done');
    // The second finishes; the refreshed data (the fixture still says doing) wins.
    await waitFor(() => expect(pendings).toHaveLength(2));
    await act(async () => pendings[1]!());
    await screen.findByText('T-104 approved');
    await waitFor(() => expect(colOf()).toBe('Doing'));
  });

  it('a drop on Review calls the mutator with status review and shows the toast', async () => {
    render(<App />);
    await board();
    const card = screen.getByRole('button', { name: /^T-104 / });
    const o = { isPrimary: true, button: 0, pointerId: 1, bubbles: true };
    act(() => void fireEvent.pointerDown(card, { ...o, clientX: 40, clientY: 80 }));
    act(() => void fireEvent.pointerMove(document, { ...o, clientX: 50, clientY: 90 }));
    act(() => void fireEvent.pointerMove(document, { ...o, clientX: 700, clientY: 300 }));
    act(() => void fireEvent.pointerUp(document, { ...o, clientX: 700, clientY: 300 }));
    await waitFor(() => expect(api.setMeta).toHaveBeenCalledWith('p1', 'T-104', recipeSpecs.find((s) => s.id === 'T-104')!.hash, 'status', 'review'));
    expect(await screen.findByText('T-104 moved to Review')).toBeTruthy();
  });

  it('while disconnected: banner, no dragging, Reconnect', async () => {
    render(<App />);
    await board();
    act(() => live.onConn!('disconnected'));
    expect(screen.getByText('Disconnected from the local server.')).toBeTruthy();
    expect(screen.getByTestId('conn').textContent).toBe('Disconnected');
    expect(screen.getByRole('button', { name: /^T-104 / }).getAttribute('aria-disabled')).toBe('true');
    const before = live.calls;
    fireEvent.click(screen.getByRole('button', { name: 'Reconnect' }));
    expect(live.calls).toBe(before + 1);
    expect(screen.getByTestId('conn').textContent).toBe('Reconnecting…');
    act(() => live.onConn!('live'));
    expect(await screen.findByText('Reconnected')).toBeTruthy();
    expect(screen.queryByText('Disconnected from the local server.')).toBeNull();
  });

  it('the theme toggle is remembered', async () => {
    render(<App />);
    await board();
    const btn = screen.getByRole('button', { name: /Switch to (dark|light) theme/ });
    const was = document.documentElement.dataset.theme;
    fireEvent.click(btn);
    const now = was === 'dark' ? 'light' : 'dark';
    expect(document.documentElement.dataset.theme).toBe(now);
    expect(localStorage.getItem('specboard.theme')).toBe(now);
  });

  it('"Open another project folder…" shows the info toast', async () => {
    render(<App />);
    await board();
    fireEvent.click(screen.getByRole('button', { name: /Recipe Box/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Open another project folder…' }));
    expect(screen.getByText('Run spec-board in a project folder')).toBeTruthy();
    expect(screen.getByText('It will appear in this list.')).toBeTruthy();
    expect(screen.queryByRole('menu')).toBeNull();
  });
it('?spec= opens the card detail; Esc closes it, clears ?spec= and returns focus to the card', async () => {
    render(<App />);
    await board();
    const card = screen.getByRole('button', { name: /^T-105 / });
    card.focus();
    fireEvent.click(card);
    const dlg = await screen.findByRole('dialog', { name: 'Shopping list export' });
    expect(within(dlg).getByText((t) => t.endsWith('T-105-shopping-list-export/spec.md'))).toBeTruthy();
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(location.search).toBe('?project=p1');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /^T-105 / }));
  });

  it('an open menu closes on Esc before the board does anything else', async () => {
    render(<App />);
    await board();
    fireEvent.click(screen.getByRole('button', { name: /Recipe Box/ }));
    expect(screen.getByRole('menu')).toBeTruthy();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('a ?spec= that is in neither active nor archived shows the removed message', async () => {
    history.replaceState(null, '', '/?project=p1&spec=T-999');
    render(<App />);
    expect(await screen.findByText('This spec was removed or archived')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(location.search).toBe('?project=p1');
  });

  it('the status menu in the detail moves through the board action', async () => {
    history.replaceState(null, '', '/?project=p1&spec=T-103');
    render(<App />);
    const dlg = await screen.findByRole('dialog', { name: 'Search & filters' });
    fireEvent.click(within(dlg).getByRole('button', { name: /Review/ }));
    fireEvent.click(within(dlg).getByRole('menuitemradio', { name: /Done/ }));
    await waitFor(() => expect(screen.getByText('T-103 approved')).toBeTruthy());
    expect(api.setMeta).toHaveBeenCalledWith('p1', 'T-103', expect.any(String), 'status', 'done');
  });
});

