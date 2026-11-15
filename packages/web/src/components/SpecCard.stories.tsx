import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { SpecCard, type SpecCardProps } from './SpecCard';
import { Urgency } from '@/components/ui/urgency/urgency';
import { allRecipeSpecs, recipeSpec } from '../fixtures/recipeBox';
import { SimpleMode } from '../state/simpleMode';

const THEMES = ['light', 'dark'] as const;

/** The same content in both themes, each on its column colour. */
function Themed({ children, col = 'var(--panel)' }: { children: ReactNode; col?: string }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap' }}>
      {THEMES.map((t) => (
        <div key={t} data-theme={t} data-testid={`theme-${t}`} style={{ background: col, color: 'var(--fg)', padding: 24, width: 348, minHeight: 120 }}>
          {children}
        </div>
      ))}
    </div>
  );
}

type Handlers = 'onOpen' | 'onArchive' | 'onUnarchive' | 'onWriteUp';
type SheetProps = { id: string; col?: string } & Partial<Omit<SpecCardProps, 'spec' | 'all'>> & Partial<Pick<SpecCardProps, Handlers>>;

function CardSheet({ id, col, ...rest }: SheetProps) {
  return (
    <Themed col={col}>
      <SpecCard spec={recipeSpec(id)} all={allRecipeSpecs} onOpen={fn()} onArchive={fn()} onUnarchive={fn()} onWriteUp={fn()} {...rest} />
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
    expect(card.style.background).toContain('var(--raise)');
  },
};

export const BeingDragged: Story = {
  args: { id: 'T-108', lifted: true },
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getAllByRole('button', { name: /^T-108 / })[0]!;
    expect(card.style.transform).toBe('rotate(-1.8deg)');
  },
};

export const BlockedQuestions: Story = {
  args: { id: 'T-105' },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.hover(c.getAllByText('Blocked')[0]!);
    expect(await c.findByText('3 open questions · Waiting on T-104 (doing)')).toBeTruthy();
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
  args: { id: 'T-103', col: 'var(--review-soft)' },
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
    await userEvent.hover(c.getAllByText(/File problem/)[0]!);
    expect(await c.findByText('The subtask on line 18 is missing its checkbox…')).toBeTruthy();
  },
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
    expect(await c.findByRole('menuitem', { name: 'Archive' })).toBeTruthy();
  },
};

function UrgencySheet() {
  return (
    <Themed col="var(--card)">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
    expect(c.getByText('3 open questions · Waiting on T-104 (doing)')).toBeTruthy();
  },
};

/** Simple mode, a card Claude is working on: the live banner stays. */
export const SimpleRunning: Story = {
  args: { id: 'T-104', running: 'Build the week grid' },
  decorators: [(Story) => <SimpleMode value>{Story()}</SimpleMode>],
};
