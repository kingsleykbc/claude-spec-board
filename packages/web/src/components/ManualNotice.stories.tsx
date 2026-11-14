import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { ManualNotice } from './ManualNotice';
import type { ComponentType } from 'react';

const meta = { title: 'Shell/ManualNotice', component: ManualNotice, args: { reason: 'not-approved' } } satisfies Meta<typeof ManualNotice>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Opens the notice and checks its reason line. */
const opens = (line: string): Story['play'] => async ({ canvasElement }) => {
  const c = within(canvasElement);
  await userEvent.click(c.getByRole('button', { name: 'Manual mode: background runs are off' }));
  expect(c.getByText('Non-agentic mode')).toBeTruthy();
  expect(c.getByText(line)).toBeTruthy();
  expect(c.getByRole('link', { name: 'How to turn on background runs' }).getAttribute('href')).toBe('/docs/running-specs#turn-on-background-runs');
};

const frame = (Story: ComponentType) => (
  <div style={{ minHeight: 260, display: 'flex', justifyContent: 'flex-end' }}>
    <Story />
  </div>
);

export const NotInstalled: Story = { args: { reason: 'not-installed' }, decorators: [frame], play: opens("Claude Code isn't installed on this computer.") };
export const NotLoggedIn: Story = { args: { reason: 'not-logged-in' }, decorators: [frame], play: opens("Claude Code isn't logged in.") };
export const Blocked: Story = { args: { reason: 'blocked' }, decorators: [frame], play: opens('Claude Code is blocked by a setting.') };
export const NotApproved: Story = { args: { reason: 'not-approved' }, decorators: [frame], play: opens("This project isn't set up for background runs.") };
