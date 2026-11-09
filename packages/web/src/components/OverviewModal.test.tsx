import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { recipeProject } from '../fixtures/recipeBox';
import { OverviewModal } from './OverviewModal';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const setup = (over: Partial<Parameters<typeof OverviewModal>[0]> = {}) => {
  const props = {
    project: recipeProject,
    name: 'Recipe Box',
    toast: vi.fn(),
    onRefresh: vi.fn(),
    onClose: vi.fn(),
    now: new Date(2026, 10, 8, 11, 30),
    ...over,
  };
  render(<OverviewModal {...props} />);
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
