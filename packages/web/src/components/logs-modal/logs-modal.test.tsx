import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { composeStories } from '@storybook/react-vite';
import { recipeProject } from '@/fixtures/recipeBox';
import { allLogEntries } from '@/state/allLogs';
import * as stories from './logs-modal.stories';

const { Grid, WithTokensAndObsolete, Empty } = composeStories(stories);

afterEach(cleanup);

const newest = allLogEntries(recipeProject)[0]!;

describe('LogsModal', () => {
  it('is a two-column grid: each entry is a row of a time cell and a content cell, with no day headings', () => {
    render(<Grid />);
    const dlg = screen.getByRole('dialog', { name: 'Logs' });
    const rows = within(dlg).getAllByRole('row');
    expect(rows).toHaveLength(allLogEntries(recipeProject).length);
    for (const r of rows) expect(within(r).getAllByRole('cell')).toHaveLength(2);
    expect(within(dlg).queryByRole('heading', { level: 2 })).toBeNull();
    expect(within(dlg).queryByText('Today')).toBeNull();
    expect(within(dlg).queryByText('Yesterday')).toBeNull();
  });

  it('the time cell shows time ago, with the exact time in a tooltip', async () => {
    render(<Grid />);
    const [time, content] = within(screen.getAllByRole('row')[0]!).getAllByRole('cell');
    expect(newest.at).toBe('2026-11-10 09:05');
    expect(time!.textContent).toBe('4 days ago');
    const trigger = within(time!).getByText('4 days ago');
    // The accessible name starts with what is shown, then the exact time.
    expect(trigger.getAttribute('aria-label')).toBe('4 days ago, 2026-11-10 09:05');
    expect(trigger.getAttribute('datetime')).toBe('2026-11-10T09:05');
    act(() => trigger.focus());
    expect((await screen.findByRole('tooltip')).textContent).toBe('2026-11-10 09:05');
    expect(within(content!).getByRole('button', { name: `${newest.specId} · ${newest.specTitle}` })).toBeTruthy();
    expect(within(content!).getByText(`Subtask ${newest.subtask} · ${newest.subtaskTitle}`)).toBeTruthy();
    expect(within(content!).getByText(newest.text)).toBeTruthy();
  });

  it('a time that cannot be read is shown raw, without a datetime attribute', () => {
    const proj = JSON.parse(JSON.stringify(recipeProject));
    proj.archived = [];
    proj.specs = [{ ...proj.specs[0], logs: { 1: { subtask: 1, commit: null, files: [], pr: null, doneAt: null, tokens: null, obsolete: null, problems: [], entries: [{ at: '2026-13-45 10:00', text: 'odd' }] } } }];
    render(<Grid project={proj} />);
    const time = screen.getByText('2026-13-45 10:00');
    expect(time.tagName).toBe('TIME');
    expect(time.hasAttribute('datetime')).toBe(false);
    expect(time.getAttribute('aria-label')).toBe('2026-13-45 10:00');
  });

  it('search filters, and shows the empty state', () => {
    render(<Grid />);
    const q = screen.getByRole('searchbox', { name: 'Search logs' });
    expect(q.getAttribute('placeholder')).toBe('Search logs');
    fireEvent.change(q, { target: { value: 'draggable recipe' } });
    expect(screen.getByText(/draggable recipe sidebar/)).toBeTruthy();
    expect(screen.queryByText(/Made slots focusable/)).toBeNull();
    fireEvent.change(q, { target: { value: 'zzzzqq' } });
    expect(screen.getByText('No logs match “zzzzqq”.')).toBeTruthy();
  });

  it('with no logs says so', () => {
    render(<Empty />);
    expect(screen.getByText('No logs yet.')).toBeTruthy();
  });

  it('clicking the spec opens it', () => {
    render(<Grid />);
    fireEvent.click(screen.getAllByRole('button', { name: `${newest.specId} · ${newest.specTitle}` })[0]!);
    expect(Grid.args.onOpenSpec).toHaveBeenCalledWith(newest.specId);
  });

  it('Open overview switches to the overview', () => {
    render(<Grid />);
    fireEvent.click(screen.getByRole('button', { name: 'Open overview' }));
    expect(Grid.args.onOpenOverview).toHaveBeenCalled();
  });

  it('shows tokens once per log, and the obsolete icon opens a popover with the reason', async () => {
    const user = userEvent.setup();
    render(<WithTokensAndObsolete />);
    expect(screen.getAllByText('48.2k tokens')).toHaveLength(1);
    const icons = screen.getAllByRole('button', { name: 'Obsolete' });
    expect(icons).toHaveLength(2);
    await user.click(icons[0]!);
    const pop = await screen.findByRole('dialog', { name: 'Obsolete' });
    expect(within(pop).getByText('Since 2026-11-12: Replaced by the new planner')).toBeTruthy();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Obsolete' })).toBeNull());
    expect(screen.getByRole('dialog', { name: 'Logs' })).toBeTruthy();
  });
});
