import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { recipeProject } from '../fixtures/recipeBox';
import { allLogEntries } from '../state/allLogs';
import { LogsModal } from './LogsModal';

afterEach(cleanup);

const setup = (over: Partial<Parameters<typeof LogsModal>[0]> = {}) => {
  const props = { project: recipeProject, onOpenSpec: vi.fn(), onOpenOverview: vi.fn(), onClose: vi.fn(), now: new Date(2026, 10, 8, 12, 0), ...over };
  render(<LogsModal {...props} />);
  return props;
};

describe('LogsModal', () => {
  it('lists entries under day headings with the spec button and subtask', () => {
    setup();
    const dlg = screen.getByRole('dialog', { name: 'Logs' });
    expect(within(dlg).getAllByRole('heading', { level: 2 }).length).toBeGreaterThan(0);
    expect(within(dlg).getByText('Added a draggable recipe sidebar that reuses RecipeCard in a compact size.')).toBeTruthy();
    expect(within(dlg).getAllByRole('button', { name: /^T-\d+ / }).length).toBeGreaterThan(0);
  });

  it('search filters, and shows the empty state', () => {
    setup();
    const q = screen.getByRole('searchbox', { name: 'Search logs' });
    expect(q.getAttribute('placeholder')).toBe('Search logs');
    fireEvent.change(q, { target: { value: 'draggable recipe' } });
    expect(screen.getByText(/draggable recipe sidebar/)).toBeTruthy();
    expect(screen.queryByText(/Made slots focusable/)).toBeNull();
    fireEvent.change(q, { target: { value: 'zzzzqq' } });
    expect(screen.getByText('No logs match “zzzzqq”.')).toBeTruthy();
  });

  it('with no logs says so', () => {
    setup({ project: { ...recipeProject, specs: [], archived: [] } });
    expect(screen.getByText('No logs yet.')).toBeTruthy();
  });

  it('clicking the spec opens it', () => {
    const p = setup();
    const first = allLogEntries(recipeProject)[0]!;
    fireEvent.click(screen.getAllByRole('button', { name: `${first.specId} ${first.specTitle}` })[0]!);
    expect(p.onOpenSpec).toHaveBeenCalledWith(first.specId);
  });

  it('Open overview switches to the overview', () => {
    const p = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Open overview' }));
    expect(p.onOpenOverview).toHaveBeenCalledOnce();
  });

  it('shows tokens once per log and the obsolete icon', () => {
    const proj = JSON.parse(JSON.stringify(recipeProject));
    proj.specs[0].logs = {
      1: { subtask: 1, commit: null, files: [], pr: null, doneAt: null, tokens: 48200, obsolete: { since: null, reason: 'dropped' }, problems: [], entries: [{ at: '2026-11-08 09:00', text: 'one' }, { at: '2026-11-08 10:00', text: 'two' }] },
    };
    setup({ project: proj });
    expect(screen.getAllByText('48.2k tokens')).toHaveLength(1);
    expect(screen.getAllByLabelText('Obsolete').length).toBeGreaterThan(0);
  });
});
