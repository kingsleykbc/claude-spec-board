import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { composeStories } from '@storybook/react-vite';
import { recipeProject } from '@/fixtures/recipeBox';
import type { OverviewModalProps } from './overview-modal';
import * as stories from './overview-modal.stories';

const { WithSummary } = composeStories(stories);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const setup = (over: Partial<OverviewModalProps> = {}) => {
  const props = {
    project: recipeProject,
    name: 'Recipe Box',
    toast: vi.fn(),
    onRefresh: vi.fn(),
    onClose: vi.fn(),
    now: new Date(2026, 10, 8, 11, 30),
    ...over,
  };
  // The story types its handlers as mocks; any handler does here.
  render(<WithSummary {...(props as Parameters<typeof WithSummary>[0])} />);
  return props;
};

describe('OverviewModal', () => {
  it('shows name, description, the ring 3/9, counts with Blocked, and the summary', () => {
    setup();
    const dlg = screen.getByRole('dialog', { name: 'Overview' });
    expect(within(dlg).getByRole('heading', { name: 'Recipe Box' })).toBeTruthy();
    expect(within(dlg).getByText(/A web app to save recipes/)).toBeTruthy();
    expect(within(dlg).getByText('3/9')).toBeTruthy();
    const counts = within(dlg).getByTestId('ov-counts');
    expect([...counts.children].map((c) => c.textContent)).toEqual(['To-do4', 'Doing1', 'Review1', 'Done3', 'Blocked2']);
    expect(within(dlg).getByText('Last updated 2h ago')).toBeTruthy();
    expect(within(dlg).getByText('Search & filters').tagName).toBe('STRONG');
  });

  it('relative images in the summary load through the image route from .specboard', () => {
    setup({ pid: 'p1', project: { ...recipeProject, overview: { updated: '2026-11-08T09:30', summaryMd: '![shot](images/a.png)' } } });
    expect(screen.getByRole('img', { name: 'shot' }).getAttribute('src')).toBe('/api/projects/p1/image?path=.specboard%2Fimages%2Fa.png');
  });

  it('with no summary shows the empty state', () => {
    setup({ project: { ...recipeProject, overview: null } });
    expect(screen.getByText('No summary yet. Ask Claude to refresh the overview.')).toBeTruthy();
    expect(screen.queryByText(/Last updated/)).toBeNull();
  });

  it('Refresh asks for a refresh', () => {
    const p = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(p.onRefresh).toHaveBeenCalledOnce();
  });

  it('not connected: Refresh is greyed but enabled, starts nothing, and shows the command to paste', async () => {
    const p = setup({ manual: 'not-logged-in' });
    const btn = screen.getByRole('button', { name: 'Refresh' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    expect(btn.className).toContain('text-fg3');
    expect(btn.getAttribute('aria-description')).toBe('Claude isn’t connected');
    fireEvent.click(btn);
    const pop = await screen.findByRole('dialog', { name: "Claude isn’t connected" });
    expect(pop.textContent).toContain('/refresh-overview');
    expect(p.onRefresh).not.toHaveBeenCalled();
  });

  it('shows only the description before the first ## heading, with inline Markdown', () => {
    const description = 'A **web app** to save recipes.\n\n## Stack\nReact and Postgres\n\n## Design\nWarm and simple';
    setup({ project: { ...recipeProject, config: { ...recipeProject.config!, description } } });
    const dlg = screen.getByRole('dialog', { name: 'Overview' });
    expect(within(dlg).getByText('web app').tagName).toBe('STRONG');
    expect(within(dlg).getByText(/to save recipes/)).toBeTruthy();
    expect(within(dlg).queryByText(/React and Postgres/)).toBeNull();
    expect(within(dlg).queryByText(/Warm and simple/)).toBeNull();
    expect(within(dlg).queryByText(/## Stack/)).toBeNull();
  });

  it('status unknown: Refresh summary is neutral, starts nothing', () => {
    const p = setup({ statusKnown: false, project: { ...recipeProject, overview: null } });
    const btn = screen.getByRole('button', { name: 'Refresh summary' });
    expect(btn.className).not.toMatch(/bg-accent/);
    fireEvent.click(btn);
    expect(p.onRefresh).not.toHaveBeenCalled();
  });

  it('the close button is pinned top right and the header keeps clear of it', () => {
    setup();
    const close = screen.getByRole('button', { name: 'Close' });
    expect(close.className).toContain('absolute');
    expect(close.className).toContain('bg-card');
    expect(screen.getByText('OVERVIEW').parentElement!.className).toContain('pr-[60px]');
  });

  it('the empty state asks for a refresh too', () => {
    const p = setup({ project: { ...recipeProject, overview: null } });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh summary' }));
    expect(p.onRefresh).toHaveBeenCalledOnce();
  });

  it('while refreshing: a disabled Refreshing button, the rewriting note, and no summary', () => {
    const p = setup({ refreshing: true });
    const btn = screen.getByRole('button', { name: 'Refreshing' });
    expect(btn).toHaveProperty('disabled', true);
    fireEvent.click(btn);
    expect(p.onRefresh).not.toHaveBeenCalled();
    expect(screen.getByText('Updating…')).toBeTruthy();
    expect(screen.getByText('Claude is rewriting the summary…')).toBeTruthy();
    expect(screen.queryByText('Search & filters')).toBeNull();
  });

  it('Export downloads <slug>-overview.md through a Blob', async () => {
    const created: Blob[] = [];
    const url = vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => {
      created.push(b as Blob);
      return 'blob:x';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    let clicked: HTMLAnchorElement | null = null;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked = this;
    });
    const p = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Export .md' }));
    expect(url).toHaveBeenCalledOnce();
    expect(clicked!.download).toBe('recipe-box-overview.md');
    expect(await created[0]!.text()).toContain('- Done: 3');
    await waitFor(() => expect(p.toast).toHaveBeenCalledWith('ok', 'Exported overview', 'recipe-box-overview.md'));
  });
});

describe('OverviewModal summary and tasks', () => {
  it('labels the summary SUMMARY, not PROGRESS', () => {
    setup();
    expect(screen.getByText('SUMMARY')).toBeTruthy();
    expect(screen.queryByText('PROGRESS')).toBeNull();
  });

  it('Tasks is collapsed by default and expands to a read-only table of the active specs', () => {
    setup();
    const btn = screen.getByRole('button', { name: 'Tasks' });
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('table')).toBeNull();
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    // The sample has two milestones and one spec with none: a table for each.
    const tables = screen.getAllByRole('table');
    expect(tables).toHaveLength(3);
    expect(within(tables[0]!).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['ID', 'Title', 'Status', 'Progress']);
    expect(screen.getAllByTestId('spec-id')).toHaveLength(recipeProject.specs.length);
    expect(within(tables[0]!).queryByRole('button')).toBeNull();
    expect(screen.queryByText('T-100')).toBeNull();
  });
});

describe('OverviewModal tokens and logs link', () => {
  const withTokens = (trackTokens: boolean, tokens: number | null) => {
    const sp = recipeProject.specs[0]!;
    const log = { subtask: 1, commit: null, files: [], pr: null, doneAt: null, tokens, obsolete: null, entries: [], problems: [] };
    return { ...recipeProject, settings: { trackTokens, problems: [] }, specs: [{ ...sp, logs: { 1: log } }, ...recipeProject.specs.slice(1)] };
  };
  it('shows Tokens used when tracking is on and the total is above 0', () => {
    setup({ project: withTokens(true, 48200) });
    expect(screen.getByText('Tokens used: 48.2k')).toBeTruthy();
  });
  it('hides it when tracking is off or the total is 0', () => {
    setup({ project: withTokens(false, 48200) });
    expect(screen.queryByText(/Tokens used/)).toBeNull();
    cleanup();
    setup({ project: withTokens(true, null) });
    expect(screen.queryByText(/Tokens used/)).toBeNull();
  });
  it('View all logs opens the logs', () => {
    const onOpenLogs = vi.fn();
    setup({ onOpenLogs });
    fireEvent.click(screen.getByRole('button', { name: 'View all logs' }));
    expect(onOpenLogs).toHaveBeenCalledOnce();
  });
});
