import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { detectEol, needsRefreshFor, replaceSection, setNeedsRefresh, setAnswers, setMetaField, setSubtaskDone } from '../src/edit.js';
import { parseSpec } from '../src/parseSpec.js';
import { demoteH2 } from '../src/sections.js';

const fixture = readFileSync(new URL('./fixtures/spec-full.md', import.meta.url), 'utf8');
const crlf = fixture.replace(/\n/g, '\r\n');

function changedLines(a: string, b: string): number[] {
  const x = a.split(/\r?\n/);
  const y = b.split(/\r?\n/);
  const out: number[] = [];
  for (let i = 0; i < Math.max(x.length, y.length); i++) if (x[i] !== y[i]) out.push(i);
  return out;
}
const noLoneLf = (s: string) => !/(?<!\r)\n/.test(s);
const lineOf = (s: string, i: number) => s.split(/\r?\n/)[i];
const NOANS = '---\nid: T-9\ntitle: X\n---\n\n## Open questions\n\n- [ ] Q1 (text): Why?\n- [ ] Q2 (text): How?\n\n## Notes\n\nkeep\n';

describe('detectEol', () => {
  it('detects', () => {
    expect(detectEol('a\nb')).toBe('\n');
    expect(detectEol('a\r\nb')).toBe('\r\n');
    expect(detectEol('abc')).toBe('\n');
  });
});

describe.each([
  ['LF', fixture],
  ['CRLF', crlf],
])('edits on %s', (_name, text) => {
  const eol = detectEol(text);
  it('setMetaField status changes one line and keeps comments', () => {
    const withComment = text.replace('status: todo', '# note\r\nstatus: todo'.replace('\r\n', eol));
    const out = setMetaField(withComment, 'status', 'doing');
    expect(changedLines(withComment, out)).toEqual([withComment.split(/\r?\n/).indexOf('status: todo')]);
    expect(out).toContain('# note');
    expect(out).toContain('status: doing');
    expect(noLoneLf(out) || eol === '\n').toBe(true);
  });
  it('setMetaField sets arrays and null', () => {
    const out = setMetaField(text, 'categories', ['Backend', 'UI']);
    expect(parseSpec(out).categories).toEqual(['Backend', 'UI']);
    expect(parseSpec(setMetaField(text, 'current_subtask', 2)).currentSubtask).toBe(2);
    if (eol === '\r\n') expect(noLoneLf(out)).toBe(true);
  });
  it('setMetaField leaves non-canonical untouched front matter lines byte-identical', () => {
    const long = 'x'.repeat(100);
    const odd = [
      '---', 'id: T-1', 'title:   "Hello: there"   # c', 'status:   todo  # s', 'categories: [A,   B]',
      'depends_on:', '- a', '- b', 'summary: ' + long + ' ' + long, 'urgency: low', '---', '', 'body', '',
    ].join(eol);
    const rows = odd.split(/\r?\n/);
    const out = setMetaField(odd, 'status', 'doing');
    const idx = rows.findIndex((l) => l.startsWith('status:'));
    expect(changedLines(odd, out)).toEqual([idx]);
    expect(lineOf(out, idx)).toBe('status: doing');
    if (eol === '\r\n') expect(noLoneLf(out)).toBe(true);
    const list = setMetaField(odd, 'depends_on', ['q']);
    expect(lineOf(list, rows.findIndex((l) => l.startsWith('depends_on:')))).toBe('depends_on: [q]');
    expect(list.split(/\r?\n/).length).toBe(rows.length - 2);
    expect(setMetaField(odd, 'categories', ['Frontend', 'Backend'])).toContain(
      'categories: [Frontend, Backend]' + eol + 'depends_on:',
    );
  });
  it('setMetaField adds an absent key as exactly one line before the closing ---', () => {
    const noUpd = text.replace(/^updated:.*\r?\n/m, '');
    const out = setMetaField(noUpd, 'updated', '2026-12-01');
    const before = noUpd.split(/\r?\n/);
    const closing = before.indexOf('---', 1);
    const expected = [...before.slice(0, closing), 'updated: 2026-12-01', ...before.slice(closing)];
    expect(out.split(/\r?\n/)).toEqual(expected);
    if (eol === '\r\n') expect(noLoneLf(out)).toBe(true);
  });
  it('setAnswers collapses newlines in values', () => {
    const out = setAnswers(text, { Q1: 'a\nb\r\nc' });
    expect(parseSpec(out).questions[0]!.answer).toBe('a b c');
    expect(out.split(/\r?\n/).length).toBe(text.split(/\r?\n/).length);
    if (eol === '\r\n') expect(noLoneLf(out)).toBe(true);
  });
  it('setSubtaskDone', () => {
    const out = setSubtaskDone(text, 2, true);
    const line = parseSpec(text).subtasks[1]!.line;
    expect(changedLines(text, out)).toEqual([line]);
    expect(lineOf(out, line)).toBe('- [x] 2. Merge duplicate ingredients');
    expect(setSubtaskDone(out, 2, false)).toBe(text);
    if (eol === '\r\n') expect(noLoneLf(out)).toBe(true);
    expect(() => setSubtaskDone(text, 9, true)).toThrow('Subtask 9 not found');
  });
  it('setAnswers sets and clears', () => {
    const q = parseSpec(text).questions[1]!;
    const out = setAnswers(text, { Q2: '3' });
    expect(changedLines(text, out)).toEqual([q.line, q.line + 1]);
    expect(lineOf(out, q.line)).toBe('- [x] Q2 (number): How many weeks ahead should the list cover?');
    expect(lineOf(out, q.line + 1)).toBe('  > answer: 3');
    if (eol === '\r\n') expect(noLoneLf(out)).toBe(true);
    const back = setAnswers(out, { Q2: '' });
    expect(lineOf(back, q.line)).toContain('- [ ] Q2');
    expect(parseSpec(back).questions[1]!.answer).toBeNull();
    expect(() => setAnswers(text, { Q9: 'x' })).toThrow('Question Q9 not found');
  });
  it('replaceSection leaves other lines identical', () => {
    const out = replaceSection(text, 'Spec', 'New text');
    const d = parseSpec(out);
    expect(d.specMd).toBe('New text');
    expect(d.featuresMd).toBe(parseSpec(text).featuresMd);
    expect(out.slice(out.indexOf('## Features'))).toBe(text.slice(text.indexOf('## Features')));
    expect(out.slice(0, out.indexOf('## Spec'))).toBe(text.slice(0, text.indexOf('## Spec')));
    if (eol === '\r\n') expect(noLoneLf(out)).toBe(true);
  });
  it('replaceSection appends a missing section', () => {
    const out = replaceSection(text, 'Review', 'Looks good');
    expect(out.startsWith(text.replace(/(\r?\n)+$/, ''))).toBe(true);
    expect(out).toContain(`${eol}## Review${eol}${eol}Looks good${eol}`);
    expect(out.endsWith(eol)).toBe(true);
    if (eol === '\r\n') expect(noLoneLf(out)).toBe(true);
  });
});

describe('setAnswers without answer line', () => {
  it('inserts one line', () => {
    const out = setAnswers(NOANS, { Q1: 'Because' });
    expect(out.split('\n').length).toBe(NOANS.split('\n').length + 1);
    expect(out).toContain('- [x] Q1 (text): Why?\n  > answer: Because\n- [ ] Q2');
    expect(parseSpec(out).questions[0]!.answer).toBe('Because');
  });
  it('inserts two in one call, CRLF', () => {
    const t = NOANS.replace(/\n/g, '\r\n');
    const out = setAnswers(t, { Q1: 'a', Q2: 'b' });
    expect(noLoneLf(out)).toBe(true);
    const d = parseSpec(out);
    expect(d.questions.map((q) => q.answer)).toEqual(['a', 'b']);
  });
  it('clearing a question with no answer line inserts nothing', () => {
    expect(setAnswers(NOANS, { Q1: '' })).toBe(NOANS);
  });
});

describe('misc', () => {
  it('setMetaField without front matter throws', () => {
    expect(() => setMetaField('# hi\n', 'status', 'done')).toThrow('No front matter');
  });
  it('round trip', () => {
    expect(parseSpec(setAnswers(fixture, { Q1: 'Yes' })).questions[0]!.answer).toBe('Yes');
  });
});

describe('F2: UTF-8 BOM', () => {
  const bom = '\uFEFF' + fixture;
  it('a BOM spec parses its id, title and status', () => {
    const d = parseSpec(bom);
    expect(d.id).toBe('T-105');
    expect(d.title).toBe('Shopping list export');
    expect(d.status).toBe('todo');
    expect(d.problems).toEqual([]);
  });
  it('setMetaField on a BOM spec keeps the BOM', () => {
    const out = setMetaField(bom, 'status', 'done');
    expect(out.startsWith('\uFEFF---')).toBe(true);
    expect(parseSpec(out).status).toBe('done');
    expect(out).toBe(bom.replace('status: todo', 'status: done'));
  });
});

describe('F3: front matter without a final newline', () => {
  it('replaces the key instead of duplicating it', () => {
    expect(setMetaField('---\nid: T-1\nstatus: todo\n---', 'status', 'done')).toBe('---\nid: T-1\nstatus: done\n---');
  });
  it('empty front matter still works', () => {
    expect(setMetaField('---\n---\n', 'status', 'done')).toBe('---\nstatus: done\n---\n');
    expect(setMetaField('---\n---', 'status', 'done')).toBe('---\nstatus: done\n---');
  });
});

describe('F4: setMetaField validation', () => {
  const t = '---\nid: T-1\nstatus: todo\n---\n';
  const bad = (key: string, value: unknown) => () => setMetaField(t, key as 'status', value as 'todo');
  it('rejects undefined and unknown enum values', () => {
    expect(bad('status', undefined)).toThrow('Invalid value for status');
    expect(bad('status', 'wip')).toThrow('Invalid value for status');
    expect(bad('urgency', 'meh')).toThrow('Invalid value for urgency');
  });
  it('rejects other bad values', () => {
    expect(bad('categories', 'a')).toThrow('Invalid value for categories');
    expect(bad('depends_on', [1])).toThrow('Invalid value for depends_on');
    expect(bad('draft', 'yes')).toThrow('Invalid value for draft');
    expect(bad('current_subtask', 0)).toThrow('Invalid value for current_subtask');
    expect(bad('current_subtask', 1.5)).toThrow('Invalid value for current_subtask');
    expect(bad('title', '  ')).toThrow('Invalid value for title');
    expect(bad('updated', '2026-1-1')).toThrow('Invalid value for updated');
    expect(bad('nope', 'x')).toThrow('Invalid key nope');
  });
  it('accepts good values', () => {
    expect(setMetaField(t, 'current_subtask', null)).toContain('current_subtask: null');
    expect(setMetaField(t, 'current_subtask', 3)).toContain('current_subtask: 3');
    expect(setMetaField(t, 'draft', true)).toContain('draft: true');
    expect(setMetaField(t, 'updated', '2026-12-01')).toContain('updated: 2026-12-01');
  });
  it('refuses a quoted key it cannot edit line by line', () => {
    expect(() => setMetaField('---\nid: T-1\n"status": todo\n---\n', 'status', 'done')).toThrow('Cannot edit status safely');
  });
});

describe('F5: ## headings in section bodies are demoted', () => {
  it('demoteH2 leaves ### and fenced lines alone', () => {
    expect(demoteH2('## a\n### b\n```\n## c\n```\n##\td\r\n## e')).toBe('### a\n### b\n```\n## c\n```\n###\td\r\n### e');
  });
  it('replaceSection demotes ## lines in the new body', () => {
    const d = parseSpec(replaceSection(fixture, 'Spec', 'intro\n## Notes\nmore'));
    expect(d.specMd).toContain('### Notes');
    expect(d.specMd).toContain('more');
  });
  it('a fake ## Subtasks in the body does not change the subtasks', () => {
    const before = parseSpec(fixture).subtasks.map(({ n, title, done }) => ({ n, title, done }));
    const d = parseSpec(replaceSection(fixture, 'Spec', '## Subtasks\n- [ ] 1. fake'));
    expect(d.subtasks.map(({ n, title, done }) => ({ n, title, done }))).toEqual(before);
  });
  it('a fenced ## line is kept', () => {
    const out = replaceSection(fixture, 'Spec', '```\n## x\n```');
    expect(out).toContain('```\n## x\n```');
    expect(parseSpec(out).specMd).toBe('```\n## x\n```');
  });
});

describe('F9: mixed line endings', () => {
  const rows = fixture.split('\n');
  const mixed = rows.map((r, i) => r + (i === rows.length - 1 ? '' : i % 2 === 0 ? '\r\n' : '\n')).join('');
  const parts = (s: string) => s.split(/(\r?\n)/);
  it('setSubtaskDone changes only the target line bytes', () => {
    const line = parseSpec(mixed).subtasks[1]!.line;
    const out = setSubtaskDone(mixed, 2, true);
    const a = parts(mixed);
    const b = parts(out);
    expect(b.length).toBe(a.length);
    const diff = a.map((p, i) => (p === b[i] ? -1 : i)).filter((i) => i >= 0);
    expect(diff).toEqual([line * 2]);
    expect(b[line * 2]).toBe('- [x] 2. Merge duplicate ingredients');
  });
  it('setMetaField and setAnswers keep every other ending', () => {
    const a = parts(mixed);
    const out = setAnswers(setMetaField(mixed, 'status', 'doing'), { Q2: '3' });
    const b = parts(out);
    expect(b.length).toBe(a.length);
    for (let i = 1; i < a.length; i += 2) expect(b[i]).toBe(a[i]);
  });
  it('an inserted answer line takes the ending of the line before it', () => {
    const t = '---\nid: T-9\n---\r\n\r\n## Open questions\r\n\r\n- [ ] Q1 (text): Why?\n- [ ] Q2 (text): How?\r\n';
    expect(setAnswers(t, { Q1: 'a' })).toBe(t.replace('- [ ] Q1 (text): Why?\n', '- [x] Q1 (text): Why?\n  > answer: a\n'));
    expect(setAnswers(t, { Q2: 'b' })).toBe(t.replace('- [ ] Q2 (text): How?\r\n', '- [x] Q2 (text): How?\r\n  > answer: b\r\n'));
  });
});

describe('setNeedsRefresh', () => {
  it('adds then removes on a CRLF file, byte-identical to the input', () => {
    const added = setNeedsRefresh(crlf, '2026-11-15');
    expect(added).toContain('needs_refresh: 2026-11-15\r\n');
    expect(noLoneLf(added)).toBe(true);
    expect(added.split('\r\n').filter((l) => l !== 'needs_refresh: 2026-11-15')).toEqual(crlf.split('\r\n'));
    expect(setNeedsRefresh(added, null)).toBe(crlf);
  });

  it('replaces an existing date and keeps every other byte', () => {
    const a = setNeedsRefresh(fixture, '2026-11-14');
    const b = setNeedsRefresh(a, '2026-11-15');
    expect(changedLines(a, b)).toHaveLength(1);
    expect(b.match(/needs_refresh:/g)).toHaveLength(1);
    expect(setNeedsRefresh(b, null)).toBe(fixture);
  });

  it('changes only one line when keys are in an unusual order', () => {
    const odd = '---\nupdated: 2026-01-01\ntitle: X\nstatus: todo\nid: T-9\ndraft: false\n---\n\nBody\n';
    const out = setNeedsRefresh(odd, '2026-11-15');
    expect(out.split('\n')).toHaveLength(odd.split('\n').length + 1);
    expect(out.split('\n').filter((l) => l !== 'needs_refresh: 2026-11-15')).toEqual(odd.split('\n'));
    expect(setNeedsRefresh(out, null)).toBe(odd);
  });

  it('removing an absent key is a no-op', () => {
    expect(setNeedsRefresh(fixture, null)).toBe(fixture);
  });

  it('removes only that line when needs_refresh is the last front-matter line', () => {
    const t = '---\nid: T-9\ntitle: X\nneeds_refresh: 2026-11-15\n---\n\nBody\n';
    expect(setNeedsRefresh(t, null)).toBe('---\nid: T-9\ntitle: X\n---\n\nBody\n');
  });

  it('removes a quoted or trailing-space needs_refresh line and nothing else', () => {
    expect(setNeedsRefresh('---\nid: T-9\nneeds_refresh: "2026-11-15"\n---\n\nB\n', null)).toBe('---\nid: T-9\n---\n\nB\n');
    expect(setNeedsRefresh('---\nid: T-9\nneeds_refresh: 2026-11-15   \ntitle: X\n---\n\nB\n', null)).toBe('---\nid: T-9\ntitle: X\n---\n\nB\n');
  });

  it('rejects a malformed date', () => {
    expect(() => setNeedsRefresh(fixture, 'yesterday')).toThrow();
  });
});

describe('needsRefreshFor', () => {
  it('is true only for non-draft todo or doing', () => {
    expect(needsRefreshFor({ status: 'todo', draft: false })).toBe(true);
    expect(needsRefreshFor({ status: 'doing', draft: false })).toBe(true);
    expect(needsRefreshFor({ status: 'review', draft: false })).toBe(false);
    expect(needsRefreshFor({ status: 'done', draft: false })).toBe(false);
    expect(needsRefreshFor({ status: 'todo', draft: true })).toBe(false);
    expect(needsRefreshFor({ status: 'doing', draft: true })).toBe(false);
  });
});
