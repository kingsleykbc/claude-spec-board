import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { MilestonePicker } from './milestone-picker';
import { NO_MILESTONE, type MilestoneOption } from '@/state/filters';
import { narrow } from '@/stories/narrow-screen';

const OPTIONS: MilestoneOption[] = [
  { value: 'Basics', label: 'Basics', done: 2, total: 3 },
  { value: 'Planner', label: 'Planner', done: 0, total: 2 },
  { value: NO_MILESTONE, label: 'No milestone', done: 1, total: 3 },
];

function Picker({ initial = 'Basics', onChange }: { initial?: string | null; onChange: (m: string | null) => void }) {
  const [value, setValue] = useState<string | null>(initial);
  return (
    <div className="flex min-h-[240px] items-start p-3">
      <MilestonePicker
        options={OPTIONS}
        value={value}
        onChange={(m) => {
          setValue(m);
          onChange(m);
        }}
      />
    </div>
  );
}

const meta = {
  title: 'Shell/FilterBar/MilestonePicker',
  component: Picker,
  args: { onChange: fn() },
} satisfies Meta<typeof Picker>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Plain text like the project title: the name in bold, " · done/total", a chevron. No box. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'Milestone: Basics' });
    expect(trigger.textContent).toBe('Basics · 2/3');
    // As rendered, the space before "·" is kept: the count is wider than the same text without it.
    const count = trigger.children[1] as HTMLElement;
    const bare = count.cloneNode() as HTMLElement;
    bare.textContent = count.textContent!.trimStart();
    trigger.append(bare);
    expect(count.getBoundingClientRect().width - bare.getBoundingClientRect().width).toBeGreaterThan(2);
    bare.remove();
    expect(Number(getComputedStyle(trigger.firstElementChild!).fontWeight)).toBeGreaterThanOrEqual(600);
    // No input-like box: no border and no background until hovered.
    expect(getComputedStyle(trigger).borderTopWidth).toBe('0px');
  },
};

/** Wide: a dropdown of the milestones with their counts, then "All milestones". */
export const Open: Story = {
  play: async ({ canvasElement, args }) => {
    const body = within(document.body);
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Milestone: Basics' }));
    const menu = await body.findByRole('menu', { name: 'Milestone' });
    expect(within(menu).getAllByRole('menuitemradio').map((x) => x.textContent)).toEqual(['Basics2/3', 'Planner0/2', 'No milestone1/3', 'All milestones']);
    await userEvent.click(within(menu).getByRole('menuitemradio', { name: 'All milestones' }));
    expect(args.onChange).toHaveBeenCalledWith(null);
    await waitFor(() => expect(body.queryByRole('menu')).toBeNull());
    expect(within(canvasElement).getByRole('button', { name: 'Milestone: All milestones' }).textContent).toBe('All milestones · 3/8');
  },
};

export const AllMilestones: Story = { args: { initial: null } };

/** Narrow (720px): the same choices in a bottom drawer that fits the screen. */
export const Narrow: Story = {
  decorators: [narrow],
  play: async ({ canvasElement, args }) => {
    const body = within(document.body);
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Milestone: Basics' }));
    const sheet = await body.findByRole('dialog', { name: 'Milestone' });
    expect(sheet.getBoundingClientRect().right).toBeLessThanOrEqual(window.innerWidth);
    await userEvent.click(within(sheet).getByRole('menuitemradio', { name: /^Planner/ }));
    expect(args.onChange).toHaveBeenCalledWith('Planner');
  },
};
