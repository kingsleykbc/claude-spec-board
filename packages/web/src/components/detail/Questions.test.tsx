import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Spec } from '@specboard/core';
import { ConflictError } from '../../api/client';
import { recipeSpec } from '../../fixtures/recipeBox';
import { createMutator } from '../../state/mutate';
import { Questions, type AnswersClient } from './Questions';

const PATH = '.specboard/specs/T-105-shopping-list-export/spec.md';

interface Opts {
  setAnswers?: AnswersClient['setAnswers'];
  /** What the refresh after a write delivers (the file as the server wrote it). */
  after?: Spec;
  newQuestions?: Set<string>;
  down?: boolean;
}

function setup(first: Spec, opts: Opts = {}) {
  const client = { setAnswers: vi.fn(opts.setAnswers ?? (async (_p: string, id: string) => ({ hash: 'h2', spec: recipeSpec(id) }))) };
  const toast = vi.fn();
  const onSeen = vi.fn();
  const mutate = createMutator(() => Promise.reject(new Error('no default')));
  let current = first;
  const refresh = vi.fn(async () => {
    current = opts.after ?? current;
    r.rerender(el(current));
  });
  const el = (sp: Spec) => (
    <Questions
      pid="p1"
      spec={sp}
      path={PATH}
      client={client}
      mutate={mutate}
      refresh={refresh}
      toast={toast}
      down={opts.down ?? false}
      newQuestions={opts.newQuestions ?? new Set()}
      onSeen={onSeen}
    />
  );
  const r = render(el(first));
  return { client, toast, refresh, onSeen };
}

const row = (qid: string) => document.querySelector(`[data-question="${qid}"]`) as HTMLElement;
const state = (qid: string) => row(qid).querySelector('[data-state]')!.textContent;
const save = () => screen.getByRole('button', { name: /Save changes|Saving…|Saved/ }) as HTMLButtonElement;

const answered = (sp: Spec, answers: Record<string, string>): Spec => ({
  ...sp,
  hash: 'h2',
  questions: sp.questions.map((q) => (q.id in answers ? { ...q, answer: answers[q.id] === '' ? null : answers[q.id]! } : q)),
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Questions', () => {
  it('renders the header count, numbers, and the inputs by type', () => {
    setup(recipeSpec('T-105'));
    expect(screen.getByText('OPEN QUESTIONS')).toBeTruthy();
    expect(screen.getByText('3 waiting on you')).toBeTruthy();
    expect(within(row('Q1')).getByText('1.')).toBeTruthy();
    const yn = within(row('Q1')).getByRole('radiogroup', { name: 'Should the export include quantities?' });
    expect(within(yn).getAllByRole('radio').map((r) => r.parentElement!.textContent)).toEqual(['Yes', 'No']);
    const num = screen.getByRole('spinbutton', { name: 'How many weeks ahead should the list cover?' }) as HTMLInputElement;
    expect(num.min).toBe('1');
    expect(row('Q2').textContent).toBe('2.How many weeks ahead should the list cover?RequiredNeeds answer'); // no unit suffix
    expect(within(row('Q3')).getAllByRole('radio').map((r) => r.parentElement!.textContent)).toEqual(['PDF', 'CSV', 'Plain text']);
    expect(['Q1', 'Q2', 'Q3'].map(state)).toEqual(['Needs answer', 'Needs answer', 'Needs answer']);
    expect(row('Q1').style.background).toBe('var(--review-soft)');
  });

  it('a text question renders a textarea with its answer', () => {
    setup(recipeSpec('T-106'));
    const ta = screen.getByRole('textbox', { name: 'Which OAuth providers should come later?' }) as HTMLTextAreaElement;
    expect(ta.value).toBe('Google and GitHub');
    expect(state('Q1')).toBe('Answered');
    expect(row('Q1').style.background).toBe('transparent');
    expect(screen.queryByText(/waiting on you/)).toBeNull();
  });

  it('empty copy when there are no questions', () => {
    setup(recipeSpec('T-104'));
    expect(screen.getByText('No open questions. Claude has what it needs.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull();
  });

  it('Save is disabled until something changes, and again when the change is undone', () => {
    setup(recipeSpec('T-105'));
    expect(save().disabled).toBe(true);
    fireEvent.click(within(row('Q1')).getByRole('radio', { name: 'Yes' }));
    expect(save().disabled).toBe(false);
    expect(screen.getByText('Unsaved answers')).toBeTruthy();
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '2' } });
    expect(state('Q2')).toBe('Unsaved');
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '' } });
    expect(state('Q2')).toBe('Needs answer');
  });

  it('answering Q1 Yes, Q2 2, Q3 CSV and saving sends only those, toasts, and the states go Needs answer → Unsaved → Answered', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const sp = recipeSpec('T-105');
    const answers = { Q1: 'Yes', Q2: '2', Q3: 'CSV' };
    const { client, toast } = setup(sp, { after: answered(sp, answers) });
    expect(['Q1', 'Q2', 'Q3'].map(state)).toEqual(['Needs answer', 'Needs answer', 'Needs answer']);
    fireEvent.click(within(row('Q1')).getByRole('radio', { name: 'Yes' }));
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '2' } });
    fireEvent.click(within(row('Q3')).getByRole('radio', { name: 'CSV' }));
    expect(['Q1', 'Q2', 'Q3'].map(state)).toEqual(['Unsaved', 'Unsaved', 'Unsaved']);
    fireEvent.click(save());
    expect(save().textContent).toBe('Saving…');
    await waitFor(() => expect(toast).toHaveBeenCalledWith('ok', 'Answers saved', `Written to ${PATH}`));
    expect(client.setAnswers).toHaveBeenCalledTimes(1);
    expect(client.setAnswers).toHaveBeenCalledWith('p1', 'T-105', sp.hash, answers);
    expect(['Q1', 'Q2', 'Q3'].map(state)).toEqual(['Answered', 'Answered', 'Answered']);
    expect(save().textContent).toBe('Saved');
    expect(screen.getByText('Claude will pick these up on its next run')).toBeTruthy();
    act(() => vi.advanceTimersByTime(1800));
    expect(save().textContent).toBe('Save changes');
    expect(save().disabled).toBe(true);
  });

  it('clearing an answer sends an empty string; unchanged answers are not sent', async () => {
    const sp = recipeSpec('T-106');
    const { client } = setup(sp);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '' } });
    expect(state('Q1')).toBe('Unsaved');
    fireEvent.click(save());
    await waitFor(() => expect(client.setAnswers).toHaveBeenCalledWith('p1', 'T-106', sp.hash, { Q1: '' }));
  });

  it('a conflict refreshes, keeps the drafts, and shows the err toast', async () => {
    const sp = recipeSpec('T-105');
    const { toast, refresh } = setup(sp, {
      setAnswers: async () => {
        throw new ConflictError('h9', 'theirs');
      },
    });
    fireEvent.click(within(row('Q1')).getByRole('radio', { name: 'No' }));
    fireEvent.click(save());
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith('err', 'Couldn’t save answers', 'The file changed. Your answers are still here. Save again.'),
    );
    expect(refresh).toHaveBeenCalled();
    expect((within(row('Q1')).getByRole('radio', { name: 'No' }) as HTMLInputElement).checked).toBe(true);
    expect(state('Q1')).toBe('Unsaved');
    expect(save().disabled).toBe(false);
  });

  it('while disconnected, Save shows the offline toast and sends nothing', () => {
    const { client, toast } = setup(recipeSpec('T-105'), { down: true });
    fireEvent.click(within(row('Q1')).getByRole('radio', { name: 'Yes' }));
    fireEvent.click(save());
    expect(client.setAnswers).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith('err', 'Disconnected from the local server.', 'Edits won’t save until it’s back.');
  });

  it('a New badge shows for live-new questions of this spec and clears after a successful save', async () => {
    const sp = recipeSpec('T-105');
    const { onSeen } = setup(sp, { newQuestions: new Set(['T-105:Q3', 'T-104:Q1']) });
    expect(within(row('Q3')).getByText('New')).toBeTruthy();
    expect(within(row('Q1')).queryByText('New')).toBeNull();
    fireEvent.click(within(row('Q3')).getByRole('radio', { name: 'PDF' }));
    fireEvent.click(save());
    await waitFor(() => expect(within(row('Q3')).queryByText('New')).toBeNull());
    expect(onSeen).toHaveBeenCalledWith(['T-105:Q3']);
  });
});
