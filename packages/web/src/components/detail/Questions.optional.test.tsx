import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import type { Question, Spec } from '@specboard/core';
import { recipeSpec } from '../../fixtures/recipeBox';
import { blockTexts } from '../../lib/vm';
import { createMutator } from '../../state/mutate';
import { openQuestions, waitItems } from '../../state/filters';
import { Questions } from './Questions';

afterEach(cleanup);

const base = recipeSpec('T-105');
const q = (over: Partial<Question>): Question => ({ ...base.questions[0]!, ...over });
const spec: Spec = {
  ...base,
  questions: [
    q({ id: 'Q1', text: 'Must decide?', required: true, recommendation: 'Yes' }),
    q({ id: 'Q2', text: 'Nice to know?', required: false, recommendation: 'No' }),
    q({ id: 'Q3', text: 'Answered optional?', required: false, answer: 'Yes' }),
  ],
};

const show = (s: Spec = spec) =>
  render(
    <Questions
      pid="p"
      spec={s}
      path="spec.md"
      client={{ setAnswers: vi.fn() }}
      mutate={createMutator(() => Promise.reject(new Error('no default')))}
      refresh={async () => undefined}
      toast={vi.fn()}
    />,
  );
const row = (id: string) => document.querySelector<HTMLElement>(`[data-question="${id}"]`)!;

describe('Questions with required and optional', () => {
  it('counts only required ones as waiting, and optional ones apart', () => {
    show();
    expect(screen.getByText('1 waiting on you')).toBeTruthy();
    expect(screen.getByText('1 optional')).toBeTruthy();
  });

  it('labels each, and shows the recommendation in brackets', () => {
    show();
    expect(within(row('Q1')).getByText('Required')).toBeTruthy();
    expect(within(row('Q1')).getByText('(recommended: Yes)')).toBeTruthy();
    expect(within(row('Q2')).getByText('Optional')).toBeTruthy();
    expect(within(row('Q2')).getByText('(recommended: No)')).toBeTruthy();
  });

  it('an unanswered optional one doesn’t ask for attention', () => {
    show();
    expect(within(row('Q1')).getByText('Needs answer')).toBeTruthy();
    expect(row('Q1').style.background).toBe('var(--review-soft)');
    expect(within(row('Q2')).getByText('Can skip')).toBeTruthy();
    expect(row('Q2').style.background).toBe('transparent');
    expect(within(row('Q3')).getByText('✓ Answered')).toBeTruthy();
  });

  it('says what happens to a blank optional one', () => {
    show();
    expect(screen.getByText('Claude goes with its recommendation on optional questions you leave blank')).toBeTruthy();
  });

  it('no recommendation, no brackets', () => {
    show({ ...spec, questions: [q({ id: 'Q1', recommendation: null })] });
    expect(screen.queryByText(/recommended/)).toBeNull();
  });
});

describe('optional questions elsewhere on the board', () => {
  const allOptional: Spec = { ...spec, status: 'todo', questions: [q({ id: 'Q1', required: false })], dependsOn: [], blocked: false, blockedReasons: [] };

  it('aren’t in the "questions for you" count', () => {
    expect(openQuestions(spec).map((x) => x.id)).toEqual(['Q1']);
    expect(waitItems([allOptional])).toEqual([]);
  });

  it('aren’t a reason on the blocked banner', () => {
    expect(blockTexts(allOptional, [allOptional])).toEqual([]);
    expect(blockTexts(spec, [spec]).find((b) => b.key === 'q')?.text).toBe('Awaiting answers on: Must decide?');
  });
});
