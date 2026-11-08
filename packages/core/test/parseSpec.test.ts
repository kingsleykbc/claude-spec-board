import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseSpec } from '../src/parseSpec.js';
import { findSections } from '../src/sections.js';

const fixture = readFileSync(new URL('./fixtures/spec-full.md', import.meta.url), 'utf8');
const FM = '---\nid: T-9\ntitle: X\n---\n';

describe('parseSpec', () => {
  it('parses fixture', () => {
    const d = parseSpec(fixture);
    expect(d.id).toBe('T-105');
    expect(d.problems).toEqual([]);
    expect(d.questions).toHaveLength(3);
    expect(d.questions[2]).toMatchObject({ id: 'Q3', type: 'choice', options: ['PDF', 'CSV', 'Plain text'] });
    expect(d.questions[0]).toMatchObject({ type: 'yesno', answer: 'yes' });
    expect(d.questions[1]!.answer).toBeNull();
    expect(d.questions[2]!.answer).toBeNull();
    expect(d.featuresMd).toContain('- ');
    expect(d.specMd.startsWith('Let a user')).toBe(true);
    expect(d.subtasks).toHaveLength(3);
    for (const s of d.subtasks) {
      expect(typeof s.n).toBe('number');
      expect(s.title).not.toBe('');
      expect(typeof s.done).toBe('boolean');
    }
    expect(d.subtasks.map((s) => s.done)).toEqual([false, false, true]);
  });

  it('question line numbers point at the "- [ ] Q" line', () => {
    const lines = fixture.split('\n');
    const d = parseSpec(fixture);
    for (const q of d.questions) expect(lines[q.line]).toMatch(/^- \[[ xX]\] Q\d+ \(/);
    for (const q of d.questions) expect(lines[q.line]).toContain(` ${q.id} (`);
    for (const s of d.subtasks) expect(lines[s.line]).toMatch(/^- \[[ xX]\] \d+\. /);
    for (const s of d.subtasks) expect(lines[s.line]).toContain(`] ${s.n}. `);
  });

  it('works with CRLF input', () => {
    const d = parseSpec(fixture.replace(/\n/g, '\r\n'));
    expect(d.questions).toHaveLength(3);
    expect(d.questions[0]!.answer).toBe('yes');
    expect(d.questions[2]!.options).toEqual(['PDF', 'CSV', 'Plain text']);
    expect(d.problems).toEqual([]);
  });

  it('case-insensitive headings', () => {
    const d = parseSpec(`${FM}\n## SUBTASKS\n\n- [ ] 1. Do it\n`);
    expect(d.subtasks).toHaveLength(1);
  });

  it('missing sections', () => {
    const d = parseSpec(`${FM}\n## Spec\n\nhello\n`);
    expect(d.subtasks).toEqual([]);
    expect(d.questions).toEqual([]);
    expect(d.problems).toEqual([]);
  });

  it('garbled question line is skipped and reported with its 1-based line', () => {
    const text = `${FM}\n## Open questions\n\n- [ ] what?\n- [ ] Q1 (yesno): ok?\n`;
    const d = parseSpec(text);
    expect(d.questions).toHaveLength(1);
    const n = text.split('\n').findIndex((l) => l === '- [ ] what?') + 1;
    expect(d.problems).toContain(`Unrecognised question line ${n}`);
  });

  it('unknown question type', () => {
    const d = parseSpec(`${FM}\n## Open questions\n- [ ] Q1 (colour): Which?\n`);
    expect(d.questions[0]!.type).toBe('text');
    expect(d.problems.length).toBe(1);
  });

  it('hasLog is false for every subtask', () => {
    expect(parseSpec(fixture).subtasks.every((s) => s.hasLog === false)).toBe(true);
  });

  it('merges front matter problems and never throws', () => {
    const d = parseSpec('---\ntitle: [unclosed\n---\n## Subtasks\n- [ ] 1. a\n');
    expect(d.problems.length).toBe(1);
    expect(d.subtasks).toHaveLength(1);
    expect(() => parseSpec('')).not.toThrow();
    expect(parseSpec('# no front matter').problems).toContain('Missing front matter');
  });

  it('whitespace-only answer counts as unanswered', () => {
    const d = parseSpec(`${FM}## Open questions\n- [ ] Q1 (text): a?\n  > answer:   \n`);
    expect(d.questions[0]!.answer).toBeNull();
  });
});

describe('findSections', () => {
  it('returns 0-based whole-file ranges, end exclusive', () => {
    const lines = ['---', 'id: x', '---', '## A', 'a1', '## B', 'b1', 'b2'];
    const m = findSections(lines);
    expect(m.get('a')).toEqual({ headingLine: 3, start: 4, end: 5 });
    expect(m.get('b')).toEqual({ headingLine: 5, start: 6, end: 8 });
  });

  it('ignores headings inside code fences', () => {
    const m = findSections(['## A', '```', '## B', '```']);
    expect([...m.keys()]).toEqual(['a']);
  });
});
