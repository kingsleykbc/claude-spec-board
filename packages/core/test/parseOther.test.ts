import { describe, expect, it } from 'vitest';
import { parseConfig, parseLog, parseOverview, parseSettings } from '../src/parseOther.js';

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
    expect(c).toEqual({ name: 'Demo', created: null, references: [], milestones: [], closingSteps: [], description: 'A project.', problems: [] });
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

describe('final fixes: logs', () => {
  it('F7: keeps numeric-looking commit hashes as written', () => {
    expect(parseLog('---\nsubtask: 1\ncommit: 12e4567\n---\n').commit).toBe('12e4567');
    expect(parseLog('---\nsubtask: 1\ncommit: 0012345\n---\n').commit).toBe('0012345');
    expect(parseLog('---\nsubtask: 1\ncommit: "0x1F"\n---\n').commit).toBe('0x1F');
  });
  it('F10: accepts heading variants and keeps the text as written', () => {
    for (const h of ['2026-11-08 14:02:33', '2026-11-08T14:02', '2026-11-08T14:02:33+01:00', '2026-11-08T14:02Z']) {
      const log = parseLog('---\nsubtask: 1\n---\n### ' + h + '\nbody\n');
      expect(log.entries).toEqual([{ at: h, text: 'body' }]);
    }
    expect(parseLog('---\nsubtask: 1\n---\n### 2026-11-08 14\nbody\n').entries).toEqual([]);
  });
});

describe('log times, tokens and obsolete', () => {
  const fm = (lines: string[]) => `---\nsubtask: 1\n${lines.join('\n')}\n---\n`;
  it('defaults to null', () => {
    const l = parseLog(fm([]));
    expect(l).toMatchObject({ doneAt: null, tokens: null, obsolete: null, problems: [] });
  });
  it('reads done_at and tokens', () => {
    const l = parseLog(fm(['done_at: 2026-11-14 10:30', 'tokens: 1200']));
    expect(l.doneAt).toBe('2026-11-14 10:30');
    expect(l.tokens).toBe(1200);
    expect(l.problems).toEqual([]);
  });
  it.each(['-5', '1.5', 'lots', '"12"'])('rejects tokens %s', (v) => {
    const l = parseLog(fm([`tokens: ${v}`]));
    expect(l.tokens).toBeNull();
    expect(l.problems).toContain('Invalid tokens');
  });
  it('accepts zero tokens', () => {
    expect(parseLog(fm(['tokens: 0'])).tokens).toBe(0);
  });
  it('splits obsolete into since and reason', () => {
    expect(parseLog(fm(['obsolete: "2026-11-14: replaced by T-005"'])).obsolete).toEqual({ since: '2026-11-14', reason: 'replaced by T-005' });
  });
  it('keeps the whole string as reason without a date', () => {
    expect(parseLog(fm(['obsolete: no longer needed'])).obsolete).toEqual({ since: null, reason: 'no longer needed' });
  });
});

describe('parseConfig created', () => {
  it('reads created', () => {
    expect(parseConfig('---\nname: A\ncreated: 2026-11-14\n---\n').created).toBe('2026-11-14');
  });
});

describe('parseSettings', () => {
  it('defaults trackTokens to true', () => {
    expect(parseSettings('')).toEqual({ trackTokens: true, problems: [] });
    expect(parseSettings('---\nother: 1\n---\n')).toEqual({ trackTokens: true, problems: [] });
  });
  it('reads booleans', () => {
    expect(parseSettings('---\ntrack_tokens: false\n---\n').trackTokens).toBe(false);
    expect(parseSettings('---\ntrack_tokens: true\n---\n').trackTokens).toBe(true);
  });
  it('keeps the default and reports a non-boolean', () => {
    const s = parseSettings('---\ntrack_tokens: maybe\n---\n');
    expect(s.trackTokens).toBe(true);
    expect(s.problems).toHaveLength(1);
  });
});
