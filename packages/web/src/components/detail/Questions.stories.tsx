import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { Spec } from '@specboard/core';
import { recipeSpec } from '../../fixtures/recipeBox';
import { createMutator } from '../../state/mutate';
import { Questions } from './Questions';

// Open questions (pinned behaviour 9).

const t105 = recipeSpec('T-105');
/** T-105 with Q1 answered and Q3 new through a live update. */
const mixed: Spec = { ...t105, questions: t105.questions.map((q) => (q.id === 'Q1' ? { ...q, answer: 'Yes' } : q)) };

const meta = {
  title: 'Detail/Questions',
  component: Questions,
  decorators: [
    (Story) => (
      <div style={{ padding: 24, maxWidth: 860, background: 'var(--card)' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    pid: 'p1',
    spec: t105,
    path: '.specboard/specs/T-105-shopping-list-export/spec.md',
    client: { setAnswers: fn(async (_pid: string, id: string) => ({ hash: 'h2', spec: recipeSpec(id) })) },
    mutate: createMutator(() => Promise.reject(new Error('no default op'))),
    refresh: fn(async () => undefined),
    toast: fn(),
  },
} satisfies Meta<typeof Questions>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Unanswered: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    expect(c.getByText('3 waiting on you')).toBeTruthy();
    expect(c.getAllByText('Needs answer')).toHaveLength(3);
    expect((c.getByRole('button', { name: 'Save changes' }) as HTMLButtonElement).disabled).toBe(true);
  },
};

export const Mixed: Story = {
  args: { spec: mixed, newQuestions: new Set(['T-105:Q3']) },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    expect(c.getByText('2 waiting on you')).toBeTruthy();
    expect(c.getByText('✓ Answered')).toBeTruthy();
    expect(c.getByText('New')).toBeTruthy();
  },
};

export const Unsaved: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole('radio', { name: 'Yes' }));
    await userEvent.type(c.getByRole('spinbutton'), '2');
    expect(c.getAllByText('● Unsaved')).toHaveLength(2);
    expect(c.getByText('Unsaved answers')).toBeTruthy();
    expect((c.getByRole('button', { name: 'Save changes' }) as HTMLButtonElement).disabled).toBe(false);
  },
};

export const Saved: Story = {
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole('radio', { name: 'CSV' }));
    await userEvent.click(c.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(c.getByRole('button', { name: '✓ Saved' })).toBeTruthy());
    expect(c.getByText('Claude will pick these up on its next run')).toBeTruthy();
    expect(args.toast).toHaveBeenCalledWith('ok', 'Answers saved', 'Written to .specboard/specs/T-105-shopping-list-export/spec.md');
    expect(args.client!.setAnswers).toHaveBeenCalledWith('p1', 'T-105', t105.hash, { Q3: 'CSV' });
  },
};

export const TextAnswer: Story = {
  name: 'Text question',
  args: { spec: recipeSpec('T-106'), path: '.specboard/specs/T-106-user-accounts/spec.md' },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    expect((c.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Google and GitHub');
  },
};

export const Empty: Story = {
  args: { spec: recipeSpec('T-104') },
  play: async ({ canvasElement }) => {
    expect(within(canvasElement).getByText('No open questions. Claude has what it needs.')).toBeTruthy();
  },
};
