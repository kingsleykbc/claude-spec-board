import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { Markdown } from './markdown';
import { recipeSpec } from '@/fixtures/recipeBox';

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
    <div className="flex flex-wrap">
      {(['light', 'dark'] as const).map((t) => (
        <div key={t} data-theme={t} className="w-[520px] bg-bg p-6 font-sans text-fg">
          <Markdown md={md} size={size} />
        </div>
      ))}
    </div>
  );
}

const meta = { title: 'UI/Markdown', component: Sheet } satisfies Meta<typeof Sheet>;
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

/** One Markdown block in the current theme, for tests that pass their own `md`. */
export const Plain: Story = {
  args: { md: SAMPLE },
  render: (args) => <Markdown {...args} />,
};

/** Lists, code, tables and nested lists: the element styles in one place. */
export const Elements: Story = {
  args: {
    md: [
      '- One',
      '  - Nested',
      '    - Deeper',
      '- Two',
      '',
      '1. First',
      '2. Second',
      '',
      '| a | b |',
      '|---|---|',
      '| 1 | 2 |',
      '',
      'A [link](https://example.com) and `code`.',
    ].join('\n'),
  },
  play: async ({ canvasElement }) => {
    const pre = canvasElement.querySelectorAll('ul');
    expect(getComputedStyle(pre[0]!).listStyleType).toBe('disc');
    expect(getComputedStyle(pre[1]!).listStyleType).toBe('circle');
    expect(getComputedStyle(pre[2]!).listStyleType).toBe('square');
    expect(getComputedStyle(canvasElement.querySelector('ol')!).listStyleType).toBe('decimal');
    expect(getComputedStyle(canvasElement.querySelector('td')!).paddingLeft).toBe('9px');
  },
};
