import { describe, expect, it } from 'vitest';
import { firstOpenYouStep, youStep } from '../src/you.js';

describe('youStep', () => {
  it('recognises the prefix and returns the rest', () => {
    expect(youStep('(you) Add the API key')).toBe('Add the API key');
    expect(youStep('  (You)   Try it on your phone ')).toBe('Try it on your phone');
  });
  it('is null for ordinary titles and mid-title mentions', () => {
    expect(youStep('Build the page')).toBeNull();
    expect(youStep('Ask (you) later')).toBeNull();
    expect(youStep('(you)')).toBeNull();
    expect(youStep('(youth) club')).toBeNull();
  });
});

describe('firstOpenYouStep', () => {
  const t = (done: boolean, title: string) => ({ done, title });
  it('is the first unticked subtask when it is a person step', () => {
    expect(firstOpenYouStep([t(true, 'Build'), t(false, '(you) Add design'), t(false, 'Wire up')])).toBe('Add design');
  });
  it('is null when the first unticked subtask is Claude’s, or all are done', () => {
    expect(firstOpenYouStep([t(false, 'Build'), t(false, '(you) Check')])).toBeNull();
    expect(firstOpenYouStep([t(true, '(you) Check')])).toBeNull();
    expect(firstOpenYouStep([])).toBeNull();
  });
});
