import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { composeStories } from '@storybook/react-vite';
import * as stories from './column.stories';

const { ToDo, Review, Empty, DropTarget, DoneWithArchived, DoneNoArchived } = composeStories(stories);

afterEach(cleanup);

describe('Column', () => {
  it('is a region named by its status, with the card count and its cards in order', () => {
    render(<ToDo />);
    const col = screen.getByRole('region', { name: 'To-do' });
    expect(within(col).getByText('4')).toBeTruthy();
    expect(within(col).getAllByText(/^T-\d+ /).map((x) => x.textContent!.split(' ')[0])).toEqual(['T-105', 'T-106', 'T-107', 'T-108']);
    expect(col.getAttribute('data-over')).toBeNull();
    expect(col.className).toMatch(/\bbg-panel\b/);
  });

  it('each status icon takes its ink from a class, not an inline style', () => {
    render(<ToDo />);
    expect(screen.getByRole('region', { name: 'To-do' }).querySelector('svg')!.parentElement!.className).toMatch(/\btext-fg2\b/);
    cleanup();
    render(<Review />);
    const icon = screen.getByRole('region', { name: 'Review' }).querySelector('svg')!.parentElement!;
    expect(icon.className).toMatch(/\btext-review-ink\b/);
    expect(icon.getAttribute('style')).toBeNull();
  });

  it('Review says Needs you and has its own tint', () => {
    render(<Review />);
    const col = screen.getByRole('region', { name: 'Review' });
    expect(within(col).getByText('Needs you')).toBeTruthy();
    expect(col.className).toMatch(/\bbg-review-soft\b/);
  });

  it('an empty column says so; no Needs you on an empty Review', () => {
    render(<Empty />);
    expect(screen.getByText('Nothing in progress')).toBeTruthy();
    cleanup();
    render(<Review specs={[]} />);
    expect(screen.getByText('Nothing waiting on you')).toBeTruthy();
    expect(screen.queryByText('Needs you')).toBeNull();
  });

  it('as a drop target: accent tint, dashed accent outline, and the placeholder at its index', () => {
    render(<DropTarget />);
    const col = screen.getByRole('region', { name: 'Review' });
    expect(col.getAttribute('data-over')).toBe('true');
    expect(col.className).toMatch(/\bbg-accent-soft\b/);
    expect(col.className).toMatch(/\boutline-dashed\b/);
    const ph = within(col).getByText('Drop to move to Review');
    expect(ph.compareDocumentPosition(within(col).getByText(/^T-103 /)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(col).queryByText('Nothing waiting on you')).toBeNull();
  });

  it('Done: Show/Hide archived (N) toggles; hidden when N is 0', () => {
    const onToggle = vi.fn();
    render(<DoneWithArchived onToggleArchived={onToggle} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show archived (1)' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    cleanup();
    render(<DoneWithArchived showArchived />);
    expect(screen.getByRole('button', { name: 'Hide archived (1)' })).toBeTruthy();
    cleanup();
    render(<DoneNoArchived />);
    expect(screen.queryByRole('button', { name: /archived/ })).toBeNull();
  });
});
