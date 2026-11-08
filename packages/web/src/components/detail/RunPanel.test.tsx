import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { RunPanel, RUN_LINES, PERMISSION_RULE, type RunStatus } from './RunPanel';

function setup(status: RunStatus) {
  const onDismiss = vi.fn();
  const onAction = vi.fn();
  render(<RunPanel status={status} lines={RUN_LINES} onDismiss={onDismiss} onAction={onAction} />);
  return { onDismiss, onAction, panel: screen.getByRole('complementary', { name: 'Run output' }) };
}

const clip = (writeText: (t: string) => Promise<void>) =>
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn(writeText) }, configurable: true });

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('RunPanel', () => {
  it('running: chip, the LINE icons, Working…, no Dismiss and no end card', () => {
    const { panel } = setup('running');
    const p = within(panel);
    expect(p.getByText('RUN OUTPUT')).toBeTruthy();
    expect(p.getByTestId('run-chip').textContent).toBe('Running');
    expect(p.getByText('Working…')).toBeTruthy();
    expect(p.queryByRole('button', { name: 'Dismiss' })).toBeNull();
    const icons = p.getAllByTestId('line-icon').map((i) => i.textContent);
    expect(icons).toEqual(['▶', '◇', '✓', '✓', '◇', '✎']);
    expect(p.getByText('specs/T-104-meal-planner-calendar.md').tagName).toBe('CODE');
    expect(p.queryByTestId('run-end')).toBeNull();
  });

  const ends: [RunStatus, string, string, string | null][] = [
    ['finished', 'Finished', 'Done. Moved to Review.', null],
    ['stopped', 'Stopped', 'Stopped by you', null],
    ['needs', 'Needs your answer', 'Stopped: needs your answer', 'Go to question'],
    ['permission', 'Permission needed', 'Stopped: permission needed', 'Copy rule'],
    ['error', 'Error', 'Error', 'Run again'],
  ];
  it.each(ends)('%s: chip, end title and action', (status, chip, title, action) => {
    const { panel, onDismiss } = setup(status);
    const p = within(panel);
    expect(p.getByTestId('run-chip').textContent).toBe(chip);
    expect(within(p.getByTestId('run-end')).getByText(title)).toBeTruthy();
    if (action) expect(p.getByRole('button', { name: action })).toBeTruthy();
    else expect(within(p.getByTestId('run-end')).queryByRole('button')).toBeNull();
    fireEvent.click(p.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('needs and error actions call onAction', () => {
    const { panel, onAction } = setup('needs');
    fireEvent.click(within(panel).getByRole('button', { name: 'Go to question' }));
    expect(onAction).toHaveBeenCalledWith('question');
    cleanup();
    const e = setup('error');
    fireEvent.click(within(e.panel).getByRole('button', { name: 'Run again' }));
    expect(e.onAction).toHaveBeenCalledWith('rerun');
  });

  it('permission renders the fix snippet and note', () => {
    const { panel } = setup('permission');
    expect(within(panel).getByText(PERMISSION_RULE).tagName).toBe('CODE');
    expect(within(panel).getByText('Add this to .claude/settings.json, or install date-fns yourself, then run again.')).toBeTruthy();
  });

  it('Copy rule confirms only after the clipboard accepts the text', async () => {
    let resolve!: () => void;
    clip(() => new Promise<void>((r) => (resolve = r)));
    const { panel, onAction } = setup('permission');
    fireEvent.click(within(panel).getByRole('button', { name: 'Copy rule' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(PERMISSION_RULE);
    expect(within(panel).queryByText('✓ Copied rule')).toBeNull();
    await act(async () => resolve());
    expect(within(panel).getByRole('button', { name: '✓ Copied rule' })).toBeTruthy();
    expect(onAction).toHaveBeenCalledWith('copy');
  });

  it('Copy rule failure says so and asks to copy by hand', async () => {
    clip(() => Promise.reject(new Error('denied')));
    const { panel, onAction } = setup('permission');
    fireEvent.click(within(panel).getByRole('button', { name: 'Copy rule' }));
    await act(async () => undefined);
    expect(within(panel).getByText('Copy failed: select the rule above and copy it.')).toBeTruthy();
    expect(onAction).not.toHaveBeenCalled();
  });
});
