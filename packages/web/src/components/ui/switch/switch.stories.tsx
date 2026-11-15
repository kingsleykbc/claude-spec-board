import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Switch } from './switch';

const meta = { title: 'UI/Switch', component: Switch } satisfies Meta<typeof Switch>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Real layout (browser run only): the thumb stays inside the track in both states, and Tab shows the focus ring. */
async function checkLayoutAndFocus(canvasElement: HTMLElement) {
  const sw = within(canvasElement).getByRole('switch');
  const thumb = sw.firstElementChild as HTMLElement;
  for (let i = 0; i < 2; i++) {
    await new Promise((r) => setTimeout(r, 250)); // let the thumb's transition finish
    const track = sw.getBoundingClientRect();
    const t = thumb.getBoundingClientRect();
    await expect(t.left).toBeGreaterThanOrEqual(track.left);
    await expect(t.right).toBeLessThanOrEqual(track.right);
    await userEvent.click(sw);
  }
  (document.activeElement as HTMLElement | null)?.blur();
  await userEvent.tab();
  await expect(document.activeElement).toBe(sw);
  await expect(getComputedStyle(sw).outlineStyle).not.toBe('none');
}

/** An on/off switch with a visible label, as Blocked only and Simple mode use. */
export const Default: Story = {
  render: (args) => (
    <label className="flex items-center gap-2 p-6 text-sm text-fg2">
      <Switch {...args} />
      Blocked only
    </label>
  ),
  play: ({ canvasElement }) => checkLayoutAndFocus(canvasElement),
};

/** Starts on. */
export const On: Story = { ...Default, args: { defaultChecked: true } };
