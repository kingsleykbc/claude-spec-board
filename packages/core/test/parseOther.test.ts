import { describe, expect, it } from 'vitest';
import { parseConfig, parseLog, parseOverview } from '../src/parseOther.js';

const LOG = [
  '---',
  'subtask: 2',
  'commit: a1b2c3d',
  'files: [src/a.ts, src/b.ts]',
  '---',
  'ignored preamble',
  '### 2026-11-08 14:02',
  'Did the first thing.',
  '',
  '### 2026-11-08 15:30',
  'Did the second thing.',
  'More detail.',
  '',
].join('\n');

describe('parseLog', () => {
  it('parses front matter and entries in order', () => {
    const log = parseLog(LOG);
    expect(log.problems).toEqual([]);
    expect(log.subtask).toBe(2);
    expect(log.commit).toBe('a1b2c3d');
    expect(log.files).toEqual(['src/a.ts', 'src/b.ts']);
    expect(log.entries).toEqual([
      { at: '2026-11-08 14:02', text: 'Did the first thing.' },
      { at: '2026-11-08 15:30', text: 'Did the second thing.\nMore detail.' },
    ]);
  });

  it('handles CRLF', () => {
    const log = parseLog(LOG.replace(/\n/g, '\r\n'));
    expect(log.subtask).toBe(2);
    expect(log.commit).toBe('a1b2c3d');
    expect(log.entries.length).toBe(2);
    expect(log.entries[0]!.at).toBe('2026-11-08 14:02');
    expect(log.entries[0]!.text).toBe('Did the first thing.');
  });

  it('no front matter gives null subtask and problems', () => {
    const log = parseLog('### 2026-11-08 14:02\nhello\n');
    expect(log.subtask).toBeNull();
    expect(log.commit).toBeNull();
    expect(log.files).toEqual([]);
    expect(log.problems.length).toBeGreaterThan(0);
    expect(log.entries.length).toBe(1);
  });

  it('empty commit is null; invalid subtask is null with a problem; broken yaml does not throw', () => {
    const a = parseLog('---\nsubtask: abc\ncommit:\n---\n');
    expect(a.subtask).toBeNull();
    expect(a.commit).toBeNull();
    expect(a.problems.length).toBe(1);
    const b = parseLog('---\nfiles: [unclosed\n---\n');
    expect(b.subtask).toBeNull();
    expect(b.problems.length).toBeGreaterThan(0);
  });
});

describe('parseConfig', () => {
  it('missing references gives []; description is trimmed body', () => {
    const c = parseConfig('---\nname: Demo\n---\n\nA project.\n\n');
    expect(c).toEqual({ name: 'Demo', references: [], description: 'A project.', problems: [] });
  });

  it('parses references', () => {
    const c = parseConfig('---\nname: Demo\nreferences: [docs/a.md, docs/b.md]\n---\nBody');
    expect(c.references).toEqual(['docs/a.md', 'docs/b.md']);
  });

  it('bad input gives defaults and problems', () => {
    expect(parseConfig('no front matter').problems.length).toBeGreaterThan(0);
    const c = parseConfig('---\nname: [unclosed\n---\nBody');
    expect(c.name).toBe('');
    expect(c.problems.length).toBeGreaterThan(0);
  });
});

describe('parseOverview', () => {
  it('empty input', () => {
    expect(parseOverview('')).toEqual({ updated: null, summaryMd: '' });
  });

  it('parses updated and body', () => {
    expect(parseOverview('---\nupdated: 2026-11-08T10:00:00Z\n---\n\nAll good.\n')).toEqual({
      updated: '2026-11-08T10:00:00Z',
      summaryMd: 'All good.',
    });
  });

  it('bad yaml gives null updated and the body', () => {
    expect(parseOverview('---\nupdated: [x\n---\nBody\n')).toEqual({ updated: null, summaryMd: 'Body' });
  });
});
