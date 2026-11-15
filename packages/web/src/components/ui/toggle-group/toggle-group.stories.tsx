import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { ToggleGroup, ToggleGroupItem } from './toggle-group';

const meta = { title: 'UI/ToggleGroup', component: ToggleGroup } satisfies Meta<typeof ToggleGroup>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A single-choice group, as the Board | Table switch uses. */
export const Default: Story = {
  args: { type: 'single', defaultValue: 'board', 'aria-label': 'View' },
  render: (args) => (
    <div className="p-6">
      <ToggleGroup {...args}>
        <ToggleGroupItem value="board">Board</ToggleGroupItem>
        <ToggleGroupItem value="table">Table</ToggleGroupItem>
      </ToggleGroup>
    </div>
  ),
  // Real styles (browser run only): Tab onto the selected item shows the focus ring.
  play: async ({ canvasElement }) => {
    const board = within(canvasElement).getByRole('radio', { name: 'Board' });
    (document.activeElement as HTMLElement | null)?.blur();
    await userEvent.tab();
    await expect(document.activeElement).toBe(board);
    await expect(getComputedStyle(board).outlineStyle).not.toBe('none');
  },
};
