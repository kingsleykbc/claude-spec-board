import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { composeStories } from '@storybook/react-vite';
import * as stories from './not-connected.stories';

const { NotInstalled, NotLoggedIn, Blocked, NotApproved, NoReason, Trigger } = composeStories(stories);

afterEach(cleanup);

const TITLE = "Claude isn’t connected to the board";

const CASES = [
  ['not-installed', NotInstalled, "Claude Code isn't installed on this computer."],
  ['not-logged-in', NotLoggedIn, "Claude Code isn't logged in."],
  ['blocked', Blocked, 'Claude Code is blocked by a setting.'],
  ['not-approved', NotApproved, "This project isn't set up for background runs."],
] as const;

describe('NotConnected', () => {
  it('renders nothing when there is no reason', () => {
    render(<NoReason />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('is an icon button, closed until clicked', () => {
    render(<NotApproved />);
    const btn = screen.getByRole('button', { name: TITLE });
    const img = btn.querySelector('img')!;
    expect(img.getAttribute('src')).toMatch(/not-connected/);
    expect(img.getAttribute('alt')).toBe('');
    expect(img.className).toMatch(/\brounded-md\b/);
    expect(img.className).toMatch(/\boverflow-hidden\b/);
    expect(btn.textContent).toBe('');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it.each(CASES)('opens and shows the %s line, the explanation and the docs link', async (_, Story, line) => {
    const user = userEvent.setup();
    render(<Story />);
    await user.click(screen.getByRole('button', { name: TITLE }));
    const pop = await screen.findByRole('dialog', { name: TITLE });
    expect(within(pop).getByText(TITLE)).toBeTruthy();
    expect(within(pop).getByText("The board can't run Claude for you here, so use the Copy command buttons and paste them into a Claude chat.")).toBeTruthy();
    expect(within(pop).getByText(line)).toBeTruthy();
    const link = within(pop).getByRole('link', { name: 'How to turn on background runs' });
    expect(link.getAttribute('href')).toBe('/docs/running-specs#turn-on-background-runs');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(pop.textContent).not.toMatch(/manual|non-agentic/i);
  });

  it('closes on Esc, on an outside click, and on a second click', async () => {
    const user = userEvent.setup();
    render(<Blocked />);
    const btn = screen.getByRole('button', { name: TITLE });
    await user.click(btn);
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await user.click(btn);
    await screen.findByRole('dialog');
    await user.click(document.body);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await user.click(btn);
    await screen.findByRole('dialog');
    await user.click(btn);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('the trigger is a greyed, enabled button; it opens the popover with the command and a Copy button', async () => {
    const user = userEvent.setup();
    render(<Trigger />);
    const btn = screen.getByRole('button', { name: 'Refresh' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    await user.click(btn);
    const pop = await screen.findByRole('dialog', { name: "Claude isn’t connected" });
    expect(within(pop).getByText('/specboard:refresh-overview')).toBeTruthy();
    expect(within(pop).getByText("Claude Code isn't logged in.")).toBeTruthy();
    expect(within(pop).getByRole('button', { name: 'Copy command' })).toBeTruthy();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
