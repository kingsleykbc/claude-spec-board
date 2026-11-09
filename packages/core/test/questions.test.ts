import { describe, expect, it } from 'vitest';
import { setAnswers } from '../src/edit.js';
import { parseSpec } from '../src/parseSpec.js';
import { deriveState } from '../src/project.js';

const spec = (lines: string, id = 'T-9') => `---\nid: ${id}\ntitle: X\n---\n\n## Open questions\n\n${lines}\n`;
const one = (line: string) => parseSpec(spec(`${line}\n  > answer:`));

describe('required and optional questions', () => {
  it('is required when unmarked, as older specs are', () => {
    const d = one('- [ ] Q1 (yesno): Keep it?');
    expect(d.questions[0]).toMatchObject({ type: 'yesno', text: 'Keep it?', required: true, recommendation: null });
    expect(d.problems).toEqual([]);
  });

  it.each([
    ['(optional yesno)', 'yesno', false, []],
    ['(OPTIONAL number)', 'number', false, []],
    ['(required text)', 'text', true, []],
    ['(optional choice: A | B)', 'choice', false, ['A', 'B']],
  ])('reads %s', (marker, type, required, options) => {
    const d = one(`- [ ] Q1 ${marker}: Pick?`);
    expect(d.questions[0]).toMatchObject({ type, required, options });
    expect(d.problems).toEqual([]);
  });

  it('flags a marker with no type instead of guessing', () => {
    const d = one('- [ ] Q1 (optional): Pick?');
    expect(d.problems).toEqual([expect.stringContaining('Unknown question type "optional"')]);
  });
});

describe('recommendations', () => {
  it('takes a trailing recommendation out of the text', () => {
    expect(one('- [ ] Q1 (yesno): Keep it? (recommended: Yes)').questions[0]).toMatchObject({ text: 'Keep it?', recommendation: 'Yes' });
  });

  it('keeps brackets inside the value and earlier in the text', () => {
    expect(one('- [ ] Q1 (text): Limit (per day)? (recommended: 14 (two weeks))').questions[0]).toMatchObject({
      text: 'Limit (per day)?',
      recommendation: '14 (two weeks)',
    });
  });

  it.each(['Keep it? (recommended:)', 'Keep it? (recommended: Yes) please', '(recommended: Yes)'])('leaves %s as plain text', (text) => {
    expect(one(`- [ ] Q1 (text): ${text}`).questions[0]).toMatchObject({ text, recommendation: null });
  });

  it('saving an answer leaves the marker and recommendation on the line', () => {
    const text = spec('- [ ] Q1 (optional yesno): Keep it? (recommended: Yes)\n  > answer:');
    const out = setAnswers(text, { Q1: 'No' });
    expect(out).toContain('- [x] Q1 (optional yesno): Keep it? (recommended: Yes)\n  > answer: No');
    expect(parseSpec(out).questions[0]).toMatchObject({ required: false, recommendation: 'Yes', answer: 'No' });
  });
});

describe('blocking', () => {
  const state = (lines: string) => deriveState([parseSpec(spec(lines))], []).get('T-9')!;

  it('an unanswered optional question blocks nothing', () => {
    expect(state('- [ ] Q1 (optional yesno): A? (recommended: Yes)\n  > answer:')).toMatchObject({ blocked: false, blockedReasons: [] });
  });

  it('counts only the required ones', () => {
    const s = state('- [ ] Q1 (optional yesno): A?\n  > answer:\n- [ ] Q2 (yesno): B?\n  > answer:\n- [x] Q3 (yesno): C?\n  > answer: Yes');
    expect(s).toMatchObject({ blocked: true, blockedReasons: ['1 open question'] });
  });
});
