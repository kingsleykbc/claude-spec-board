import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { composeStories } from '@storybook/react-vite';
import type { Spec } from '@specboard/core';
import { recipeArchived, recipeSpecs } from '@/fixtures/recipeBox';
import { NO_FILTERS } from '@/state/filters';
import type { TableViewProps } from './table-view';
import * as stories from './table-view.stories';

const { Flat, Milestones, TrackingOff, Compact, LongTitle } = composeStories(stories);

afterEach(cleanup);

// Basics: T-101, T-102, T-103 and archived T-100; Planner: T-104, T-105; Polish: none; the rest have no milestone.
const MS = ['Basics', 'Planner', 'Polish'];
const IN: Record<string, string> = { 'T-100': 'Basics', 'T-101': 'Basics', 'T-102': 'Basics', 'T-103': 'Basics', 'T-104': 'Planner', 'T-105': 'Planner' };
const withMs = (xs: Spec[]) => xs.map((x) => ({ ...x, milestone: IN[x.id] ?? null }));

function table(props: Partial<TableViewProps> = {}) {
  const p: TableViewProps = { specs: recipeSpecs, archived: recipeArchived, milestones: [], simple: false, trackTokens: false, onOpen: vi.fn(), ...props };
  // The story's args type onOpen as a mock; any handler does here.
  render(<Flat {...(p as Parameters<typeof Flat>[0])} />);
  return p;
}

/** The spec IDs of the rows in a table, in order. */
const rowIds = (t: HTMLElement) => within(t).queryAllByTestId('spec-id').map((x) => x.textContent);
const headers = (t: HTMLElement) => within(t).getAllByRole('columnheader').map((h) => h.textContent);

describe('TableView', () => {
  it('one row per spec, in status order then the board order; title opens the detail', () => {
    const p = table();
    const [t] = screen.getAllByRole('table');
    expect(rowIds(t!)).toEqual(['T-106', 'T-105', 'T-108', 'T-107', 'T-104', 'T-103', 'T-101', 'T-102']);
    expect(headers(t!)).toEqual(['Subtasks', 'ID', 'Title', 'Status', 'Progress', 'Urgency', 'Categories']);
    fireEvent.click(screen.getByRole('button', { name: recipeSpecs.find((x) => x.id === 'T-104')!.title }));
    expect(p.onOpen).toHaveBeenCalledWith('T-104');
  });

  it('shows status, progress and the "you" marker titled with why the spec waits on you', () => {
    table();
    const row = screen.getByTestId('row-T-104');
    const t104 = recipeSpecs.find((x) => x.id === 'T-104')!;
    expect(within(row).getByText('Doing')).toBeTruthy();
    expect(within(row).getByText(`${t104.subtasks.filter((x) => x.done).length}/${t104.subtasks.length}`)).toBeTruthy();
    expect(within(screen.getByTestId('row-T-103')).getByTitle('Waiting on your review')).toBeTruthy();
    expect(screen.getAllByTitle('Waiting on your review')).toHaveLength(1);
    expect(within(screen.getByTestId('row-T-105')).getByTitle('3 questions for you').textContent).toBe('you');
    expect(within(screen.getByTestId('row-T-101')).queryByText('you')).toBeNull();
  });

  it('Simple mode hides the urgency and categories columns', () => {
    table({ simple: true });
    expect(headers(screen.getAllByRole('table')[0]!)).toEqual(['Subtasks', 'ID', 'Title', 'Status', 'Progress']);
    expect(document.querySelector('[data-urgency]')).toBeNull();
  });

  it('a Tokens column with the summed log tokens when tracking is on, blank when none', () => {
    const t104 = recipeSpecs.find((x) => x.id === 'T-104')!;
    const logs = Object.fromEntries(Object.entries(t104.logs).map(([k, l], i) => [k, { ...l, tokens: i === 0 ? 48210 : 1000 }]));
    const specs = recipeSpecs.map((x) => (x.id === 'T-104' ? { ...x, logs } : x));
    table({ specs, trackTokens: true });
    expect(headers(screen.getAllByRole('table')[0]!)).toContain('Tokens');
    expect(within(screen.getByTestId('row-T-104')).getByTestId('tokens').textContent).toBe('49.2k');
    expect(within(screen.getByTestId('row-T-103')).getByTestId('tokens').textContent).toBe('');
    cleanup();
    table({ specs, trackTokens: false });
    expect(headers(screen.getAllByRole('table')[0]!)).not.toContain('Tokens');
  });

  it('a row expands to its subtasks: number, title without (you), tick and you tag', () => {
    const t104 = recipeSpecs.find((x) => x.id === 'T-104')!;
    const subtasks = [
      { ...t104.subtasks[0]!, n: 1, title: 'Build the grid', done: true },
      { ...t104.subtasks[0]!, n: 2, title: '(you) Add the API key', done: false },
    ];
    table({ specs: recipeSpecs.map((x) => (x.id === 'T-104' ? { ...x, subtasks } : x)) });
    const btn = screen.getByRole('button', { name: 'Subtasks of T-104' });
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    const list = document.getElementById(btn.getAttribute('aria-controls')!)!;
    expect(list.hidden).toBe(true);
    expect(within(screen.getByTestId('row-T-104')).getByTitle('Your step: Add the API key')).toBeTruthy();
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(list.hidden).toBe(false);
    const items = within(list).getAllByRole('listitem');
    expect(items.map((x) => x.textContent)).toEqual(['1.Build the grid', '2.Add the API keyyou']);
    expect(within(items[0]!).getByLabelText('Done')).toBeTruthy();
    expect(within(items[1]!).getByLabelText('Not done')).toBeTruthy();
    fireEvent.click(btn);
    expect(list.hidden).toBe(true);
  });

  it('archived specs sit in a closed Archived section', () => {
    table();
    const head = screen.getByRole('button', { name: /^Archived/ });
    expect(head.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByTestId('row-T-100')).toBeNull();
    fireEvent.click(head);
    expect(screen.getByTestId('row-T-100')).toBeTruthy();
  });

  it('with milestones: one section per milestone, open, collapsible, then No milestone', () => {
    table({ specs: withMs(recipeSpecs), archived: withMs(recipeArchived), milestones: MS });
    const heads = screen.getAllByRole('button', { expanded: true }).filter((b) => b.dataset.section !== undefined);
    expect(heads.map((h) => h.textContent)).toEqual(['Basics · 3/4', 'Planner · 0/2', 'Polish · 0/0', 'No milestone · 0/3']);
    const tables = screen.getAllByRole('table');
    expect(tables.map(rowIds)).toEqual([['T-103', 'T-101', 'T-102'], ['T-105', 'T-104'], [], ['T-106', 'T-108', 'T-107']]);
    expect(screen.getByText('No specs in this milestone yet.')).toBeTruthy();
    fireEvent.click(heads[1]!);
    expect(heads[1]!.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByTestId('row-T-105')).toBeNull();
    fireEvent.click(heads[1]!);
    expect(screen.getByTestId('row-T-105')).toBeTruthy();
  });

  it('applies category, urgency and blocked filters but never the milestone', () => {
    table({ specs: withMs(recipeSpecs), archived: withMs(recipeArchived), milestones: MS, filters: { ...NO_FILTERS, blocked: true, milestone: 'Basics' } });
    expect(screen.getAllByRole('table').flatMap(rowIds)).toEqual(['T-105', 'T-108']);
  });

  it('filters that hide everything → "No specs match the filters.", not "No specs yet."', () => {
    table({ filters: { ...NO_FILTERS, cats: ['Nothing'] } });
    expect(screen.getByText('No specs match the filters.')).toBeTruthy();
    expect(screen.queryByText('No specs yet.')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('a milestone whose only specs are archived has no empty message', () => {
    const archived = recipeArchived.map((x) => ({ ...x, milestone: 'Polish' }));
    table({ specs: withMs(recipeSpecs), archived, milestones: MS });
    expect(screen.getByRole('button', { name: 'Polish · 1/1' })).toBeTruthy();
    expect(screen.queryByText('No specs in this milestone yet.')).toBeNull();
  });

  it('no specs at all → "No specs yet."', () => {
    table({ specs: [], archived: [] });
    expect(screen.getByText('No specs yet.')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
    cleanup();
    table({ specs: [], archived: [], milestones: MS });
    expect(screen.getByText('No specs yet.')).toBeTruthy();
    expect(screen.queryByText('No specs in this milestone yet.')).toBeNull();
  });

  it('sits in a horizontally scrollable wrapper', () => {
    table();
    expect(screen.getByTestId('table-scroll').contains(screen.getAllByRole('table')[0]!)).toBe(true);
  });
});

describe('TableView compact', () => {
  it('shows only ID, Title, Status and Progress; no buttons, no archived section', () => {
    table({ compact: true, onOpen: undefined, milestones: MS, specs: withMs(recipeSpecs), archived: withMs(recipeArchived) });
    const tables = screen.getAllByRole('table');
    expect(headers(tables[0]!)).toEqual(['ID', 'Title', 'Status', 'Progress']);
    expect(within(tables[0]!).queryByRole('button')).toBeNull();
    expect(screen.queryByText(/Archived/)).toBeNull();
    expect(screen.queryByText('T-100')).toBeNull();
    expect(screen.getAllByRole('button').every((b) => b.hasAttribute('data-section'))).toBe(true);
  });
});

/** Each table's colgroup as `col` widths, in order ('auto' for the Title column). */
const colWidths = () =>
  screen.getAllByRole('table').map((t) => [...t.querySelectorAll('colgroup > col')].map((c) => (c as HTMLElement).style.width || 'auto'));

describe('TableView columns', () => {
  it('every group in the Milestones story shares one fixed column template', () => {
    render(<Milestones />);
    fireEvent.click(screen.getByRole('button', { name: /^Archived/ }));
    const tables = screen.getAllByRole('table');
    expect(tables).toHaveLength(5);
    for (const t of tables) expect(t.className).toContain('table-fixed');
    const widths = colWidths();
    for (const w of widths) expect(w).toEqual(widths[0]);
    expect(widths[0]).toEqual(['40px', '96px', 'auto', '140px', '96px', '112px', '220px', '96px']);
    // One col per header cell, so the template and the headers never drift apart.
    for (const t of tables) expect(t.querySelectorAll('colgroup > col')).toHaveLength(within(t).getAllByRole('columnheader').length);
  });

  it('tracking off: no Tokens col and no Tokens header', () => {
    render(<TrackingOff />);
    expect(screen.queryByRole('columnheader', { name: 'Tokens' })).toBeNull();
    for (const w of colWidths()) expect(w).toEqual(['40px', '96px', 'auto', '140px', '96px', '112px', '220px']);
  });

  it('Simple mode drops the Urgency and Categories cols', () => {
    table({ simple: true, trackTokens: true });
    expect(colWidths()).toEqual([['40px', '96px', 'auto', '140px', '96px', '96px']]);
  });

  it('compact keeps its own column set, shared across its groups', () => {
    render(<Compact />);
    const widths = colWidths();
    expect(widths).toHaveLength(4);
    for (const w of widths) expect(w).toEqual(['96px', 'auto', '140px', '96px']);
  });

  it('a long title truncates, and its Hint shows the full title', async () => {
    render(<LongTitle />);
    const long = 'Meal planner calendar with drag and drop between days, weekly totals and a printable shopping summary';
    const btn = screen.getByRole('button', { name: long });
    expect(btn.className).toContain('truncate');
    fireEvent.focus(btn);
    await waitFor(() => expect(screen.getByRole('tooltip').textContent).toBe(long));
  });

  it('the "you" marker opens a popover with why the spec waits on you', async () => {
    table();
    fireEvent.click(within(screen.getByTestId('row-T-103')).getByRole('button', { name: 'Why is T-103 waiting on you?' }));
    const pop = await screen.findByRole('dialog', { name: 'Waiting on you' });
    expect(pop.textContent).toContain('Waiting on your review');
  });
});
