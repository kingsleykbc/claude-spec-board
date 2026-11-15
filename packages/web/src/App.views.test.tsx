import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { Project, Spec } from '@specboard/core';
import { recipeArchived, recipeProject, recipeSpecs } from './fixtures/recipeBox';

// Board | Table switch and the milestone dropdown, through the whole app.

vi.mock('./api/live', () => ({ connectLive: () => () => undefined }));

// Basics: T-101, T-102 (done), T-103 (review) and archived T-100; Planner: T-104, T-105; Polish: none; the rest none.
const MS = ['Basics', 'Planner', 'Polish'];
const IN: Record<string, string> = { 'T-100': 'Basics', 'T-101': 'Basics', 'T-102': 'Basics', 'T-103': 'Basics', 'T-104': 'Planner', 'T-105': 'Planner' };
const withMs = (xs: Spec[]) => xs.map((x) => ({ ...x, milestone: IN[x.id] ?? null }));

const project = (milestones: string[]): Project => ({
  ...recipeProject,
  config: { ...recipeProject.config!, milestones },
  specs: milestones.length ? withMs(recipeSpecs) : recipeSpecs,
  archived: milestones.length ? withMs(recipeArchived) : recipeArchived,
});

vi.mock('./api/client', async (orig) => {
  const real = await orig<typeof import('./api/client')>();
  return {
    ...real,
    api: {
      projects: vi.fn(async () => [
        { id: 'p1', name: 'Recipe Box', root: '/x/recipe-box', progress: { done: 3, total: 9 } },
        { id: 'p2', name: 'Plain', root: '/x/plain', progress: { done: 3, total: 9 } },
      ]),
      project: vi.fn(async (pid: string) => ({
        entry: { id: pid, name: pid, root: `/x/${pid}` },
        project: project(pid === 'p1' ? MS : []),
        nextId: 'T-109',
      })),
    },
  };
});

import { App } from './App';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('specboard.tour', 'seen');
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

const open = async (pid: string) => {
  history.replaceState(null, '', `/?project=${pid}`);
  render(<App />);
  await screen.findByRole('radiogroup', { name: 'View' });
};
/** Card IDs on the board. */
const cards = () =>
  [...document.querySelectorAll('[data-tour="columns"] [role="button"][aria-label]')].map((x) => x.getAttribute('aria-label')!.split(' ')[0]).sort();
const rows = () => screen.queryAllByTestId('spec-id').map((x) => x.textContent!).sort();
const view = (name: 'Board' | 'Table') => within(screen.getByRole('radiogroup', { name: 'View' })).getByRole('radio', { name: `${name} view` });

describe('Board | Table switch', () => {
  it('toggles between the board and the table and is kept for the next visit', async () => {
    await open('p2');
    expect(view('Board').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radiogroup', { name: 'View' }).dataset.tour).toBe('view');
    expect(screen.queryByRole('table')).toBeNull();
    fireEvent.click(view('Table'));
    expect(view('Table').getAttribute('aria-checked')).toBe('true');
    expect(screen.getAllByRole('table').length).toBeGreaterThan(0);
    expect(document.querySelector('[data-tour="columns"]')).toBeNull();
    expect(localStorage.getItem('specboard.view')).toBe('table');
    cleanup();
    await open('p2');
    expect(view('Table').getAttribute('aria-checked')).toBe('true');
  });

  it('the table shows as many rows as the board shows cards, under the same filters', async () => {
    await open('p2');
    fireEvent.click(screen.getByRole('switch', { name: 'Blocked only' }));
    const onBoard = cards();
    expect(onBoard).toEqual(['T-105', 'T-108']);
    fireEvent.click(view('Table'));
    expect(rows()).toEqual(onBoard);
  });
});

describe('milestone dropdown', () => {
  it('is absent without milestones', async () => {
    await open('p2');
    expect(screen.queryByRole('button', { name: /milestone/i })).toBeNull();
    expect(cards()).toHaveLength(recipeSpecs.length);
  });

  it('starts at the current milestone; the board shows only its cards; All milestones shows all', async () => {
    await open('p1');
    const btn = screen.getByRole('button', { name: 'Milestone: Basics' });
    expect(cards()).toEqual(['T-101', 'T-102', 'T-103']);
    // A Radix menu opens on pointer-down or Enter, not a bare click event.
    fireEvent.keyDown(btn, { key: 'Enter' });
    const menu = screen.getByRole('menu', { name: 'Milestone' });
    expect(within(menu).getAllByRole('menuitemradio').map((x) => x.textContent)).toEqual([
      'Basics3/4',
      'Planner0/2',
      'Polish0/0',
      'No milestone0/3',
      'All milestones',
    ]);
    fireEvent.click(within(menu).getByRole('menuitemradio', { name: /^Planner/ }));
    expect(screen.queryByRole('menu', { name: 'Milestone' })).toBeNull();
    expect(cards()).toEqual(['T-104', 'T-105']);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Milestone: Planner' }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'All milestones' }));
    expect(screen.getByRole('button', { name: 'Milestone: All milestones' })).toBeTruthy();
    expect(cards()).toHaveLength(recipeSpecs.length);
  });

  it('is board-only: the table shows every milestone', async () => {
    await open('p1');
    fireEvent.click(view('Table'));
    expect(screen.queryByRole('button', { name: /^Milestone:/ })).toBeNull();
    expect(rows()).toHaveLength(recipeSpecs.length);
  });
});
