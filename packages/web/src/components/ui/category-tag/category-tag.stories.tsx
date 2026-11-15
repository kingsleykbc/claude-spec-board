import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { CategoryTag } from './category-tag';

const meta = { title: 'UI/CategoryTag', component: CategoryTag, args: { name: 'Search' } } satisfies Meta<typeof CategoryTag>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A category pill; the dot's colour comes from the name. */
export const Default: Story = {
  decorators: [(Story) => <div className="p-6">{Story()}</div>],
};

/** A few names side by side, so the dot colours can be compared. */
export const Several: Story = {
  render: () => (
    <div className="flex gap-1.5 p-6">
      {['Search', 'Meal plans', 'Shopping', 'Infra'].map((n) => (
        <CategoryTag key={n} name={n} />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const dot = (n: string) => getComputedStyle(c.getByText(n).firstElementChild!).backgroundColor;
    expect(dot('Search')).toMatch(/^oklch\(0\.66 0\.14 /);
    expect(dot('Search')).not.toBe(dot('Shopping'));
  },
};
