import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { composeStories } from '@storybook/react-vite';
import { obsoleteText } from './subtask-log';
import * as stories from './subtask-log.stories';

const { Default, Obsolete, ObsoleteNoDate } = composeStories(stories);

afterEach(cleanup);

const base = { subtask: 1, commit: '4f2a91c', pr: null, doneAt: null, tokens: null, obsolete: null, files: [], entries: [], problems: [] };

describe('SubtaskLog', () => {
  it('missing data shows nothing for that part', () => {
    render(<Default log={{ subtask: 1, commit: null, pr: null, doneAt: null, tokens: null, obsolete: null, files: [], entries: [{ at: 'sometime', text: 'Did a thing.' }], problems: [] }} />);
    expect(screen.getByText('sometime')).toBeTruthy();
    expect(screen.getByText('Did a thing.')).toBeTruthy();
    expect(screen.queryByText('FILES CHANGED')).toBeNull();
    expect(screen.queryByText('COMMIT')).toBeNull();
  });

  it('shows a PR link, done time and tokens after the commit', () => {
    render(<Default log={{ ...base, pr: 'https://github.com/o/r/pull/7', doneAt: '2026-11-07 15:12', tokens: 48200 }} />);
    const a = screen.getByRole('link', { name: 'PR' });
    expect(a.getAttribute('href')).toBe('https://github.com/o/r/pull/7');
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('rel')).toBe('noopener noreferrer');
    expect(screen.getByText('Done Nov 7, 15:12')).toBeTruthy();
    expect(screen.getByText('48.2k tokens')).toBeTruthy();
    const meta = screen.getByTestId('log-meta').textContent ?? '';
    expect(meta.indexOf('4f2a91c')).toBeLessThan(meta.indexOf('PR'));
    expect(meta.indexOf('PR')).toBeLessThan(meta.indexOf('Done'));
    expect(meta.indexOf('Done')).toBeLessThan(meta.indexOf('tokens'));
  });

  it('shows a non-http PR value as plain text, not a link', () => {
    render(<Default log={{ ...base, pr: 'javascript:alert(1)' }} />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('javascript:alert(1)')).toBeTruthy();
  });

  it('the obsolete icon opens a popover titled Obsolete with "Since <date>: <reason>"; Esc closes it', async () => {
    const user = userEvent.setup();
    render(<Obsolete />);
    const b = screen.getByRole('button', { name: 'Obsolete' });
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(b);
    const pop = await screen.findByRole('dialog', { name: 'Obsolete' });
    expect(within(pop).getByText('Obsolete')).toBeTruthy();
    expect(within(pop).getByText('Since 2026-11-10: Replaced by the new planner')).toBeTruthy();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('obsolete without a date shows the reason alone', async () => {
    const user = userEvent.setup();
    render(<ObsoleteNoDate />);
    await user.click(screen.getByRole('button', { name: 'Obsolete' }));
    const pop = await screen.findByRole('dialog', { name: 'Obsolete' });
    expect(within(pop).getByText('Dropped')).toBeTruthy();
    expect(within(pop).queryByText(/Since/)).toBeNull();
  });

  it('obsoleteText (the logs list) keeps its one-line form', () => {
    expect(obsoleteText({ since: '2026-11-10', reason: 'Replaced by T-9' })).toBe('Obsolete since 2026-11-10: Replaced by T-9');
    expect(obsoleteText({ since: null, reason: 'Dropped' })).toBe('Obsolete: Dropped');
  });
});
