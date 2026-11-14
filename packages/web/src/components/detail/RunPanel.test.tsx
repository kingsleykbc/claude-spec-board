import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { EndInfo, RunKind } from '../../api/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { LINE } from '../../lib/vm';
import { resetMode, setPluginMode } from '../../lib/mode';
import { RunPanel, RUN_LINES, type RunStatus } from './RunPanel';

/** The markup of a run-log line kind's icon. */
const iconHtml = (k: string) => {
  const Icon = LINE[k]![0];
  return renderToStaticMarkup(<Icon aria-hidden />);
};

const RULE = 'specboard allow "Bash(npm install:*)"\nspecboard allow "Bash(npm test:*)"';
const permission: EndInfo = { status: 'permission', title: 'Claude needs permission', text: 'Claude was stopped from using Bash.', fix: RULE };

function setup(status: RunStatus, end?: EndInfo | null, kind?: RunKind) {
  const onDismiss = vi.fn();
  const onAction = vi.fn();
  render(<RunPanel status={status} lines={RUN_LINES} onDismiss={onDismiss} onAction={onAction} {...(end !== undefined ? { end } : {})} {...(kind ? { kind } : {})} />);
  return { onDismiss, onAction, panel: screen.getByRole('complementary', { name: 'Run output' }) };
}

const clip = (writeText: (t: string) => Promise<void>) =>
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn(writeText) }, configurable: true });

afterEach(() => {
  cleanup();
  resetMode();
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
    const icons = p.getAllByTestId('line-icon').map((i) => i.innerHTML);
    expect(icons).toEqual(['start', 'read', 'ok', 'done', 'read', 'edit'].map(iconHtml));
    expect(p.getByText('specs/T-104-meal-planner-calendar.md').closest('code')?.tagName).toBe('CODE');
    expect(p.queryByTestId('run-end')).toBeNull();
  });

  // With no end info from the server, the copy falls back to the prototype's.
  const ends: [RunStatus, string, string, string | null][] = [
    ['finished', 'Finished', 'Done. Moved to Review.', null],
    ['stopped', 'Stopped', 'Stopped by you', null],
    ['needs', 'Needs your answer', 'Stopped: needs your answer', 'Go to question'],
    ['permission', 'Permission needed', 'Stopped: permission needed', null],
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

  it('a needs end that waits on a (you) step is a calm pause with no question button', () => {
    const { panel } = setup('needs', { status: 'needs', title: 'Waiting on you', text: 'Add the key', waiting: 'Add the key' });
    const p = within(panel);
    expect(p.getByTestId('run-chip').textContent).toBe('Waiting on you');
    const card = within(p.getByTestId('run-end'));
    expect(card.getByText('Waiting on you')).toBeTruthy();
    expect(card.getByText('Claude stopped at your step: Add the key. Do it, tick it, then run again.')).toBeTruthy();
    expect(p.queryByRole('button', { name: 'Go to question' })).toBeNull();
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

  it('finished with refusals: shows the server\'s line, keeps the Review title, offers no rule', () => {
    const text = 'Claude was refused 1 action on the way. Check the result before moving this to Done.';
    const { panel } = setup('finished', { status: 'finished', text, denied: [{ tool: 'Bash', input: { command: 'curl x' } }] });
    const card = within(within(panel).getByTestId('run-end'));
    expect(card.getByText('Done. Moved to Review.')).toBeTruthy();
    expect(card.getByText(text)).toBeTruthy();
    expect(card.queryByRole('button')).toBeNull();
    expect(card.queryByText(/specboard allow/)).toBeNull();
  });

  it('explains how to run the rule until publish, with the project path, and Copy rule still copies the rule only', async () => {
    clip(async () => undefined);
    render(<RunPanel status="permission" lines={[]} end={permission} projectRoot="C:\my projects\app" onDismiss={vi.fn()} onAction={vi.fn()} />);
    const card = within(screen.getByTestId('run-end'));
    expect(card.getByText('Until Spec Board is published, run it from the Spec Board repo as `npm run specboard -- allow "<rule>" "C:\\my projects\\app"`.')).toBeTruthy();
    await act(async () => {
      fireEvent.click(card.getByRole('button', { name: 'Copy rule' }));
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(RULE);
  });

  it('in the plugin, offers no terminal-only specboard allow: it asks Claude to run setup or init instead', () => {
    setPluginMode(true);
    render(<RunPanel status="permission" lines={[]} end={permission} projectRoot="C:\my projects\app" onDismiss={vi.fn()} onAction={vi.fn()} />);
    const card = within(screen.getByTestId('run-end'));
    expect(card.getByText('Ask Claude to run /specboard:setup again to update the allowed commands, or ask Claude to run `specboard init --yes --no-skills --runs yes "C:\\my projects\\app"`.')).toBeTruthy();
    expect(card.queryByText(/specboard allow/)).toBeNull();
    expect(card.queryByText(/Spec Board repo/)).toBeNull();
    expect(card.queryByRole('button', { name: 'Copy rule' })).toBeNull();
  });

  it('shows a line\'s after text behind its code', () => {
    render(<RunPanel status="permission" lines={[{ seq: 1, k: 'err', text: 'Not allowed:', code: 'git push', after: '· 12.3k tokens', time: '10:00' }]} end={permission} onDismiss={vi.fn()} onAction={vi.fn()} />);
    const line = screen.getByText('git push').parentElement!;
    expect(line.textContent).toBe('Not allowed: git push · 12.3k tokens');
  });

  it('without a project root the note names the path in words', () => {
    setup('permission', permission);
    expect(screen.getByText('Until Spec Board is published, run it from the Spec Board repo as `npm run specboard -- allow "<rule>" <project path>`.')).toBeTruthy();
  });

  it('the server\'s title and text replace the fallback copy', () => {
    const { panel } = setup('error', { status: 'error', title: 'Claude Code exited with code 2', text: 'It broke.' });
    expect(within(panel).getByText('Claude Code exited with code 2')).toBeTruthy();
    expect(within(panel).getByText('It broke.')).toBeTruthy();
    expect(within(panel).queryByText(/exited unexpectedly/)).toBeNull();
  });

  it('a title with no text keeps the fallback text', () => {
    const { panel } = setup('error', { status: 'error', title: 'Claude Code exited with code 2' });
    expect(within(panel).getByText('Claude Code exited unexpectedly. Work up to the last commit is safe.')).toBeTruthy();
  });

  it.each([
    ['run', 'Done. Moved to Review.'],
    ['write-up', 'Written up'],
    ['fix-file', 'Fixed'],
  ] as const)('a finished %s says "%s"', (kind, title) => {
    const { panel } = setup('finished', { status: 'finished' }, kind);
    expect(within(panel).getByText(title)).toBeTruthy();
  });

  it('permission renders every fix line and the note', () => {
    const { panel } = setup('permission', permission);
    const code = within(panel).getByText((_, el) => el?.tagName === 'CODE' && el.textContent === RULE);
    expect(code.tagName).toBe('CODE');
    expect(within(panel).getByText('Run this in a terminal, then run again.')).toBeTruthy();
    expect(within(panel).getByText('Claude was stopped from using Bash.')).toBeTruthy();
  });

  it('blocked by policy (no fix): the server\'s text, no snippet, no note, no Copy rule', () => {
    const { panel } = setup('permission', { status: 'permission', title: 'Claude needs permission', text: 'This action is blocked by this project\'s rules.' });
    expect(within(panel).getByText('This action is blocked by this project\'s rules.')).toBeTruthy();
    expect(within(panel).queryByRole('button', { name: 'Copy rule' })).toBeNull();
    expect(within(panel).queryByText('Run this in a terminal, then run again.')).toBeNull();
  });

  it('lines are keyed by seq: a new line keeps the existing nodes', () => {
    const props = { status: 'running' as const, onDismiss: () => undefined, onAction: () => undefined };
    const { rerender } = render(<RunPanel {...props} lines={RUN_LINES.slice(1)} />);
    const node = screen.getByText('specs/T-104-meal-planner-calendar.md');
    rerender(<RunPanel {...props} lines={RUN_LINES} />);
    expect(screen.getByText('specs/T-104-meal-planner-calendar.md')).toBe(node);
  });

  it('Copy rule confirms only after the clipboard accepts the text', async () => {
    let resolve!: () => void;
    clip(() => new Promise<void>((r) => (resolve = r)));
    const { panel, onAction } = setup('permission', permission);
    fireEvent.click(within(panel).getByRole('button', { name: 'Copy rule' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(RULE);
    expect(within(panel).queryByText('Copied rule')).toBeNull();
    await act(async () => resolve());
    expect(within(panel).getByRole('button', { name: 'Copied rule' })).toBeTruthy();
    expect(onAction).toHaveBeenCalledWith('copy');
  });

  it('Copy rule failure says so and asks to copy by hand', async () => {
    clip(() => Promise.reject(new Error('denied')));
    const { panel, onAction } = setup('permission', permission);
    fireEvent.click(within(panel).getByRole('button', { name: 'Copy rule' }));
    await act(async () => undefined);
    expect(within(panel).getByText('Copy failed: select the rule above and copy it.')).toBeTruthy();
    expect(onAction).not.toHaveBeenCalled();
  });
});
