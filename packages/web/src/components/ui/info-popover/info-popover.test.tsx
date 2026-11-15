import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { composeStories } from '@storybook/react-vite';
import * as stories from './info-popover.stories';

const { Default, Untitled } = composeStories(stories);

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function stubHover(hover: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: hover && q.includes('hover: hover'), media: q, addEventListener() {}, removeEventListener() {} }));
}

describe('InfoPopover', () => {
  it('opens on click with its title, and Escape closes it', async () => {
    const user = userEvent.setup();
    render(<Default />);
    const trigger = screen.getByRole('button', { name: 'Why is this card obsolete?' });
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(trigger);
    const pop = await screen.findByRole('dialog', { name: 'Obsolete' });
    expect(pop.textContent).toContain('Obsolete');
    expect(pop.textContent).toContain('Replaced by T-104');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('without a title, the popover is named by the label', async () => {
    const user = userEvent.setup();
    render(<Untitled />);
    await user.click(screen.getByRole('button', { name: 'Why is this card obsolete?' }));
    expect((await screen.findByRole('dialog', { name: 'Why is this card obsolete?' })).textContent).toBe('Replaced by T-104, which covers the same ground.');
  });

  it('hover-capable: pointerenter opens it and leaving closes it after 150ms', () => {
    stubHover(true);
    vi.useFakeTimers();
    render(<Default />);
    const trigger = screen.getByRole('button', { name: 'Why is this card obsolete?' });
    fireEvent.pointerEnter(trigger);
    expect(screen.getByRole('dialog', { name: 'Obsolete' })).toBeTruthy();
    fireEvent.pointerLeave(trigger);
    act(() => void vi.advanceTimersByTime(149));
    expect(screen.queryByRole('dialog')).not.toBeNull();
    act(() => void vi.advanceTimersByTime(1));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('hover-capable: a click after the hover pins it open (leaving does not close it), and a second click closes it', () => {
    stubHover(true);
    render(<Default />);
    const trigger = screen.getByRole('button', { name: 'Why is this card obsolete?' });
    fireEvent.pointerEnter(trigger);
    fireEvent.click(trigger);
    expect(screen.queryByRole('dialog')).not.toBeNull();
    vi.useFakeTimers();
    fireEvent.pointerLeave(trigger);
    act(() => void vi.advanceTimersByTime(500));
    expect(screen.queryByRole('dialog')).not.toBeNull();
    fireEvent.click(trigger);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Escape after a click returns focus to the trigger without reopening it', async () => {
    const user = userEvent.setup();
    render(<Default />);
    await user.click(screen.getByRole('button', { name: 'Why is this card obsolete?' }));
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('after a focus-open, Enter moves focus into the popover', async () => {
    const user = userEvent.setup();
    render(<Default />);
    const trigger = screen.getByRole('button', { name: 'Why is this card obsolete?' });
    act(() => trigger.focus());
    const pop = await screen.findByRole('dialog');
    await user.keyboard('{Enter}');
    expect(pop.contains(document.activeElement)).toBe(true);
    expect(screen.queryByRole('dialog')).not.toBeNull();
  });

  it('a focus-opened popover closes when focus leaves the trigger elsewhere', async () => {
    render(
      <>
        <Default />
        <button>other</button>
      </>,
    );
    act(() => screen.getByRole('button', { name: 'Why is this card obsolete?' }).focus());
    await screen.findByRole('dialog');
    act(() => screen.getByRole('button', { name: 'other' }).focus());
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('moving from the trigger into the content within 150ms keeps it open', () => {
    stubHover(true);
    vi.useFakeTimers();
    render(<Default />);
    const trigger = screen.getByRole('button', { name: 'Why is this card obsolete?' });
    fireEvent.pointerEnter(trigger);
    fireEvent.pointerLeave(trigger);
    act(() => void vi.advanceTimersByTime(100));
    fireEvent.pointerEnter(screen.getByRole('dialog'));
    act(() => void vi.advanceTimersByTime(500));
    expect(screen.queryByRole('dialog')).not.toBeNull();
    fireEvent.pointerLeave(screen.getByRole('dialog'));
    act(() => void vi.advanceTimersByTime(150));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('touch (no hover): pointerenter does nothing and a click opens it', async () => {
    stubHover(false);
    const user = userEvent.setup();
    render(<Default />);
    const trigger = screen.getByRole('button', { name: 'Why is this card obsolete?' });
    fireEvent.pointerEnter(trigger);
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(trigger);
    expect(await screen.findByRole('dialog', { name: 'Obsolete' })).toBeTruthy();
  });

  it('keyboard focus (:focus-visible) opens it; plain focus does not', () => {
    render(<Default />);
    const trigger = screen.getByRole('button', { name: 'Why is this card obsolete?' });
    const real = trigger.matches.bind(trigger);
    trigger.matches = (s: string) => (s === ':focus-visible' ? false : real(s));
    fireEvent.focus(trigger);
    expect(screen.queryByRole('dialog')).toBeNull();
    trigger.matches = (s: string) => (s === ':focus-visible' ? true : real(s));
    fireEvent.focus(trigger);
    expect(screen.queryByRole('dialog')).not.toBeNull();
  });
});
