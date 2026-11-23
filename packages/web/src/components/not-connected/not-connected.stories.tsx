import type { ComponentType } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { NotConnected, NotConnectedTrigger } from './not-connected';

const meta = { title: 'Shell/NotConnected', component: NotConnected, args: { reason: 'not-approved' } } satisfies Meta<typeof NotConnected>;
export default meta;
type Story = StoryObj<typeof meta>;

const TITLE = "Claude isn’t connected to the board";

/** Opens the popover and checks its title, reason line and docs link. */
const opens =
  (line: string): Story['play'] =>
  async ({ canvasElement }) => {
    const c = within(canvasElement);
    const body = within(document.body);
    await userEvent.click(c.getByRole('button', { name: TITLE }));
    const pop = await body.findByRole('dialog', { name: TITLE });
    expect(within(pop).getByText(TITLE)).toBeTruthy();
    expect(within(pop).getByText(line)).toBeTruthy();
    expect(within(pop).getByRole('link', { name: 'How to turn on background runs' }).getAttribute('href')).toBe('/docs/running-specs#turn-on-background-runs');
    // The icon is 22px with rounded corners.
    const img = c.getByRole('button', { name: TITLE }).querySelector('img')!;
    expect(img.getBoundingClientRect().width).toBe(22);
    expect(getComputedStyle(img).borderTopLeftRadius).not.toBe('0px');
    await userEvent.keyboard('{Escape}');
  };

const frame = (Story: ComponentType) => (
  <div className="flex min-h-[260px] justify-end p-3">
    <Story />
  </div>
);

export const NotInstalled: Story = { args: { reason: 'not-installed' }, decorators: [frame], play: opens("Claude Code isn't installed on this computer.") };
export const NotLoggedIn: Story = { args: { reason: 'not-logged-in' }, decorators: [frame], play: opens("Claude Code isn't logged in.") };
export const Blocked: Story = { args: { reason: 'blocked' }, decorators: [frame], play: opens('Claude Code is blocked by a setting.') };
export const NotApproved: Story = { args: { reason: 'not-approved' }, decorators: [frame], play: opens("This project isn't set up for background runs.") };
export const NoReason: Story = { args: { reason: null }, decorators: [frame] };

/** The greyed button behind Have Claude write this up and Refresh: not disabled, with the command to paste. */
export const Trigger: Story = {
  render: () => (
    <NotConnectedTrigger label="Refresh" reason="not-logged-in" command="/refresh-overview">
      Refresh
    </NotConnectedTrigger>
  ),
  decorators: [frame],
  play: async ({ canvasElement }) => {
    const btn = within(canvasElement).getByRole('button', { name: 'Refresh' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    await userEvent.click(btn);
    const pop = await within(document.body).findByRole('dialog', { name: "Claude isn’t connected" });
    expect(within(pop).getByText('/refresh-overview')).toBeTruthy();
    await userEvent.keyboard('{Escape}');
  },
};
