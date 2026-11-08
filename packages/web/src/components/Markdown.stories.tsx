import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { Markdown } from './Markdown';
import { StatusChip } from './StatusChip';
import { recipeSpec } from '../fixtures/recipeBox';

const SAMPLE = [
  '# Title',
  '',
  'Some **bold** and `code` in a paragraph that is long enough to wrap onto a second line when the column is narrow.',
  '',
  '## Features',
  '- One',
  '- Two with `inline code`',
  '',
  '### A sub heading',
  '',
  '```',
  'npm test',
  '```',
  '',
].join('\n');

function Sheet({ md, size }: { md: string; size?: 'sm' | 'md' }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap' }}>
      {(['light', 'dark'] as const).map((t) => (
        <div key={t} data-theme={t} style={{ background: 'var(--bg)', color: 'var(--fg)', padding: 24, width: 520, fontFamily: 'var(--sans)' }}>
          <Markdown md={md} size={size} />
        </div>
      ))}
    </div>
  );
}

const meta = { title: 'Components/Markdown', component: Sheet } satisfies Meta<typeof Sheet>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Medium: Story = {
  args: { md: SAMPLE },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const h1 = c.getAllByRole('heading', { level: 2 })[0]!;
    expect(getComputedStyle(h1).fontSize).toBe('20px');
    expect(getComputedStyle(h1).fontWeight).toBe('600');
    const h2 = c.getAllByRole('heading', { level: 3 })[0]!;
    expect(getComputedStyle(h2).textTransform).toBe('uppercase');
    expect(getComputedStyle(h2).fontSize).toBe('11.5px');
  },
};

export const Small: Story = {
  args: { md: SAMPLE, size: 'sm' },
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-size]') as HTMLElement;
    expect(getComputedStyle(root).fontSize).toBe('14px');
  },
};

export const Empty: Story = {
  args: { md: '' },
  play: async ({ canvasElement }) => {
    expect(within(canvasElement).getAllByText('Nothing here yet.')).toHaveLength(2);
  },
};

export const RealSpecBody: Story = {
  args: { md: recipeSpec('T-105').bodyMd },
};

function Chips() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap' }}>
      {(['light', 'dark'] as const).map((t) => (
        <div key={t} data-theme={t} style={{ background: 'var(--bg)', color: 'var(--fg)', padding: 24, display: 'flex', gap: 6, fontFamily: 'var(--sans)' }}>
          {(['todo', 'doing', 'review', 'done', 'blocked'] as const).map((s) => (
            <StatusChip key={s} status={s} />
          ))}
        </div>
      ))}
    </div>
  );
}

export const StatusChips: StoryObj<typeof Chips> = {
  render: () => <Chips />,
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    for (const l of ['To-do', 'Doing', 'Review', 'Done', 'Blocked']) expect(c.getAllByText(new RegExp(l))).toHaveLength(2);
  },
};
