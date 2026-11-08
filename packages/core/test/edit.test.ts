import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { detectEol, replaceSection, setAnswers, setMetaField, setSubtaskDone } from '../src/edit.js';
import { parseSpec } from '../src/parseSpec.js';

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
