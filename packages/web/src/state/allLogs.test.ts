import { describe, expect, it } from 'vitest';
import type { Project, Spec } from '@specboard/core';
import { allLogEntries, filterLogs, groupByDay, projectTokens, type LogItem } from './allLogs';

const log = (over: Record<string, unknown>) => ({ subtask: 1, commit: null, files: [], pr: null, doneAt: null, tokens: null, obsolete: null, entries: [], problems: [], ...over });
const spec = (id: string, title: string, logs: Record<number, unknown>, subtasks: { n: number; title: string }[] = [], archived = false) =>
  ({ id, title, archived, subtasks: subtasks.map((s) => ({ ...s, done: false, line: 0, hasLog: true })), logs }) as unknown as Spec;
const project = (specs: Spec[], archived: Spec[] = []) => ({ specs, archived }) as unknown as Project;

const P = project(
  [
    spec(
      'T-1',
      'Planner',
      {
        1: log({ tokens: 1200, entries: [{ at: '2026-11-07 15:12', text: 'First' }, { at: '2026-11-07 15:31', text: 'Second' }] }),
        3: log({ subtask: 3, entries: [{ at: '2026-11-07 15:31', text: 'Same minute' }] }),
      },
      [{ n: 1, title: '(you) Check the grid' }],
    ),
  ],
  [spec('T-0', 'Old one', { 2: log({ subtask: 2, tokens: 300, obsolete: { since: null, reason: 'gone' }, entries: [{ at: '2026-11-08 09:00', text: 'Archived entry' }] }) }, [{ n: 2, title: 'Drop' }], true)],
);

describe('allLogEntries', () => {
  const items = allLogEntries(P);
  it('is newest first, ties by spec ID then subtask', () => {
    expect(items.map((i) => i.text)).toEqual(['Archived entry', 'Second', 'Same minute', 'First']);
  });
  it('strips the (you) prefix and falls back to "Subtask n"', () => {
    expect(items.find((i) => i.text === 'First')!.subtaskTitle).toBe('Check the grid');
    expect(items.find((i) => i.text === 'Same minute')!.subtaskTitle).toBe('Subtask 3');
  });
  it('puts tokens on the newest entry of a log only', () => {
    expect(items.map((i) => i.tokens)).toEqual([300, 1200, null, null]);
  });
  it('carries archived and obsolete', () => {
    expect(items[0]!.archived).toBe(true);
    expect(items[0]!.obsolete).toEqual({ since: null, reason: 'gone' });
  });
});

describe('groupByDay', () => {
  const mk = (at: string): LogItem => ({ at, specId: 'T-1', specTitle: 't', subtask: 1, subtaskTitle: 's', text: at, tokens: null, obsolete: null, archived: false });
  it('labels Today, Yesterday, else the date', () => {
    const g = groupByDay([mk('2026-11-14 10:00'), mk('2026-11-14 09:00'), mk('2026-11-13 23:59'), mk('2026-11-01 08:00:30')], new Date(2026, 10, 14, 12, 0));
    expect(g.map((x) => [x.label, x.items.length])).toEqual([['Today', 2], ['Yesterday', 1], ['2026-11-01', 1]]);
  });
  it('handles month boundaries for Yesterday', () => {
    const g = groupByDay([mk('2026-10-31 10:00')], new Date(2026, 10, 1, 0, 5));
    expect(g[0]!.label).toBe('Yesterday');
  });
});

describe('filterLogs', () => {
  const items = allLogEntries(P);
  it('matches text, spec ID, spec title and subtask title, case-insensitively', () => {
    expect(filterLogs(items, 'SECOND').map((i) => i.text)).toEqual(['Second']);
    expect(filterLogs(items, 't-0').map((i) => i.text)).toEqual(['Archived entry']);
    expect(filterLogs(items, 'old one')).toHaveLength(1);
    expect(filterLogs(items, 'check the grid')).toHaveLength(2);
  });
  it('returns everything for a blank query', () => {
    expect(filterLogs(items, '  ')).toHaveLength(4);
  });
});

describe('projectTokens', () => {
  it('adds active and archived logs', () => {
    expect(projectTokens(P)).toBe(1500);
  });
});
