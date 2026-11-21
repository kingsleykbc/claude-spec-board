import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Spec } from '@specboard/core';
import { SpecCard, type SpecCardProps } from './spec-card';
import { Urgency } from '@/components/ui/urgency/urgency';
import { allRecipeSpecs, recipeSpec } from '@/fixtures/recipeBox';
import { SimpleMode } from '@/state/simpleMode';
import { narrow } from '@/stories/narrow-screen';

const THEMES = ['light', 'dark'] as const;

/** The same content in both themes, each on its column colour (`col` is a token name: panel, review-soft, card). */
function Themed({ children, col = 'panel' }: { children: ReactNode; col?: 'panel' | 'review-soft' | 'card' }) {
  const bg = { panel: 'bg-panel', 'review-soft': 'bg-review-soft', card: 'bg-card' }[col];
  return (
    <div className="flex flex-wrap">
      {THEMES.map((t) => (
        <div key={t} data-theme={t} data-testid={`theme-${t}`} className={`${bg} min-h-[120px] w-[348px] p-6 text-fg`}>
          {children}
        </div>
      ))}
    </div>
  );
}

type Handlers = 'onOpen' | 'onArchive' | 'onUnarchive' | 'onWriteUp';
type SheetProps = { id: string; col?: 'panel' | 'review-soft' | 'card'; patch?: Partial<Spec> } & Partial<Omit<SpecCardProps, 'spec' | 'all'>> &
  Partial<Pick<SpecCardProps, Handlers>>;

/** One sample card (by ID, optionally patched) in both themes. */
function CardSheet({ id, col, patch, ...rest }: SheetProps) {
  return (
    <Themed col={col}>
      <SpecCard spec={{ ...recipeSpec(id), ...patch }} all={allRecipeSpecs} onOpen={fn()} onArchive={fn()} onUnarchive={fn()} onWriteUp={fn()} {...rest} />
    </Themed>
  );
}

const meta = {
  title: 'Components/SpecCard',
  component: CardSheet,
  args: { id: 'T-101' },
} satisfies Meta<typeof CardSheet>;
export default meta;
type Story = StoryObj<typeof meta>;

export const DefaultDone: Story = {
  args: { id: 'T-101' },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    expect(c.getAllByText('Recipe list page')).toHaveLength(2);
    expect(c.getAllByText('4/4')).toHaveLength(2);
    expect(c.getAllByRole('button', { name: 'Card actions' })).toHaveLength(2);
  },
};

export const Hover: Story = {
  args: { id: 'T-106', forceHover: true },
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getAllByRole('button', { name: /^T-106 / })[0]!;
    expect(card.className).toMatch(/\bbg-raise\b/);
  },
};

export const BeingDragged: Story = {
  args: { id: 'T-108', lifted: true },
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getAllByRole('button', { name: /^T-108 / })[0]!;
    expect(card.getAttribute('data-lifted')).toBe('true');
  },
};

export const BlockedQuestions: Story = {
  args: { id: 'T-105' },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getAllByRole('button', { name: 'Why is T-105 blocked?' })[0]!);
    const pop = await within(document.body).findByRole('dialog', { name: 'Blocked' });
    expect(pop.textContent).toContain('3 open questions · Waiting on T-104 (doing)');
    await userEvent.keyboard('{Escape}');
  },
};

export const Chat: Story = {
  name: 'Working in a chat',
  args: { id: 'T-104', chat: 2 },
  play: async ({ canvasElement }) => {
    expect(within(canvasElement).getAllByText('Claude is working on step 2 in a chat')).toHaveLength(2);
  },
};

export const Running: Story = {
  args: { id: 'T-104', running: 'Persist planned meals' },
  play: async ({ canvasElement }) => {
    expect(within(canvasElement).getAllByText(/Persist planned meals/)).toHaveLength(2);
  },
};

export const Writing: Story = {
  args: { id: 'T-107', writing: true },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    expect(c.getAllByText('Claude is writing it up')).toHaveLength(2);
    expect(c.queryByRole('button', { name: /Have Claude write this up/ })).toBeNull();
  },
};

export const InReview: Story = {
  args: { id: 'T-103', col: 'review-soft' },
  play: async ({ canvasElement }) => {
    expect(within(canvasElement).getAllByText('Waiting on your review')).toHaveLength(2);
  },
};

export const Draft: Story = {
  args: { id: 'T-107' },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    expect(c.getAllByText('Draft')).toHaveLength(2);
    expect(c.getAllByRole('button', { name: /Have Claude write this up/ })).toHaveLength(2);
  },
};

export const FileProblem: Story = {
  args: { id: 'T-109' },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getAllByRole('button', { name: 'What is wrong with the T-109 file?' })[0]!);
    const pop = await within(document.body).findByRole('dialog', { name: 'File problem' });
    expect(pop.textContent).toContain('The subtask on line 18 is missing its checkbox…');
    await userEvent.keyboard('{Escape}');
  },
};

/** More than two dependencies: counts instead of IDs (red while one is open). */
export const ManyNeeds: Story = {
  args: { id: 'T-108', patch: { dependsOn: ['T-101', 'T-102', 'T-106'] } },
};

export const Archived: Story = {
  args: { id: 'T-100' },
  play: async ({ canvasElement }) => {
    expect(within(canvasElement).getAllByText('· Archived')).toHaveLength(2);
  },
};

export const MenuOpen: Story = {
  args: { id: 'T-102' },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getAllByRole('button', { name: 'Card actions' })[0]!);
    // The menu is portalled out of the card (a dropdown that stays on screen).
    expect(await within(document.body).findByRole('menuitem', { name: 'Archive' })).toBeTruthy();
    await userEvent.keyboard('{Escape}');
  },
};

/** Narrow screen: the ⋯ menu of a Done card opens as a bottom drawer. */
export const MenuNarrow: Story = {
  args: { id: 'T-102' },
  decorators: [narrow],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getAllByRole('button', { name: 'Card actions' })[0]!);
    const sheet = await within(document.body).findByRole('dialog', { name: 'Card actions' });
    expect(within(sheet).getByRole('menuitem', { name: 'Archive' })).toBeTruthy();
    await userEvent.keyboard('{Escape}');
  },
};

function UrgencySheet() {
  return (
    <Themed col="card">
      <div className="flex flex-col gap-3">
        {(['urgent', 'high', 'normal', 'low'] as const).map((u) => (
          <Urgency key={u} level={u} />
        ))}
      </div>
    </Themed>
  );
}

export const UrgencyLevels: StoryObj<typeof UrgencySheet> = {
  render: () => <UrgencySheet />,
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    for (const label of ['Urgent', 'High', 'Normal', 'Low']) expect(c.getAllByText(label)).toHaveLength(2);
  },
};

/** Simple mode: ID, title, the start of the description and progress; the rest behind ⋯, with a dot because T-105 is blocked. */
export const SimpleBlocked: Story = {
  args: { id: 'T-105' },
  decorators: [(Story) => <SimpleMode value>{Story()}</SimpleMode>],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement.querySelector('[data-testid="theme-light"]')!);
    expect(c.queryByText('Blocked')).toBeNull();
    await userEvent.click(c.getByRole('button', { name: 'More about T-105' }));
    const menu = await within(document.body).findByRole('menu', { name: 'More about T-105' });
    expect(within(menu).getByText('3 open questions · Waiting on T-104 (doing)')).toBeTruthy();
    await userEvent.keyboard('{Escape}');
  },
};

/** Simple mode on a narrow screen: the ⋯ details (long blocked reasons included) open in a bottom drawer. */
export const SimpleBlockedNarrow: Story = {
  args: { id: 'T-105' },
  decorators: [(Story) => <SimpleMode value>{Story()}</SimpleMode>, narrow],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement.querySelector('[data-testid="theme-light"]')!);
    await userEvent.click(c.getByRole('button', { name: 'More about T-105' }));
    const sheet = await within(document.body).findByRole('dialog', { name: 'More about T-105' });
    expect(within(sheet).getByText('3 open questions · Waiting on T-104 (doing)')).toBeTruthy();
    await userEvent.keyboard('{Escape}');
  },
};

/** Simple mode, a card Claude is working on: the live banner stays. */
export const SimpleRunning: Story = {
  args: { id: 'T-104', running: 'Build the week grid' },
  decorators: [(Story) => <SimpleMode value>{Story()}</SimpleMode>],
};
