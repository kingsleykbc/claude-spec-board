import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { InlineMarkdown } from './inline-markdown';

function Sheet({ md }: { md: string }) {
  return (
    <div className="flex flex-wrap">
      {(['light', 'dark'] as const).map((t) => (
        <div key={t} data-theme={t} className="w-[320px] bg-bg p-6 font-sans text-[13px] text-fg2">
          <InlineMarkdown md={md} />
        </div>
      ))}
    </div>
  );
}

const meta = { title: 'UI/InlineMarkdown', component: Sheet } satisfies Meta<typeof Sheet>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Bold, italics, code and strike-through render; links read as plain text; images are dropped. */
export const Basic: Story = {
  args: { md: 'Filters for **tags** and **cook time**, *quick* `grep` ~~old~~ [docs](http://x) ![a](b.png)' },
  play: async ({ canvasElement }) => {
    expect(within(canvasElement).getAllByText('tags')).toHaveLength(2);
  },
};

/** The same component for the plain test cases, which pass their own `md`. */
export const Plain: Story = {
  args: { md: 'Plain text' },
};
