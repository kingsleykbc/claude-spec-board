import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { SpecCard } from './SpecCard';
import { allRecipeSpecs, recipeSpec } from '../fixtures/recipeBox';

afterEach(cleanup);

function setup(id: string, props: Partial<Parameters<typeof SpecCard>[0]> = {}) {
  const fns = { onOpen: vi.fn(), onArchive: vi.fn(), onUnarchive: vi.fn(), onWriteUp: vi.fn() };
  const view = render(<SpecCard spec={recipeSpec(id)} all={allRecipeSpecs} {...fns} {...props} />);
  return { ...fns, ...view, card: screen.getByRole('button', { name: new RegExp(`^${id} `) }) };
}

describe('SpecCard', () => {
  it('T-105 shows Blocked, and its hover tip lists the reasons', () => {
    setup('T-105');
    const chip = screen.getByText('Blocked').closest('span')!;
    expect(screen.queryByText(/3 open questions/)).toBeNull();
    fireEvent.mouseEnter(chip);
    expect(screen.getByText('3 open questions · Waiting on T-104 (doing)')).toBeTruthy();
    fireEvent.mouseLeave(chip);
    expect(screen.queryByText(/3 open questions/)).toBeNull();
  });

  it('shows the first file problem in a tip', () => {
    setup('T-109');
    fireEvent.mouseEnter(screen.getByText(/File problem/));
    expect(screen.getByText('The subtask on line 18 is missing its checkbox…')).toBeTruthy();
  });

  it("T-108's dependency T-106 uses the block colour and bold", () => {
    setup('T-108');
    const id = screen.getByText('T-106');
    expect(id.style.color).toBe('var(--block-ink)');
    expect(id.style.fontWeight).toBe('600');
  });

  it('a done dependency is muted and regular weight', () => {
    setup('T-103'); // needs T-102, which is done
    const id = screen.getByText('T-102');
    expect(id.style.color).toBe('var(--fg3)');
    expect(id.style.fontWeight).toBe('400');
  });

  it('shows counts instead of IDs when there are more than two', () => {
    const base = recipeSpec('T-108');
    const spec = { ...base, dependsOn: ['T-101', 'T-102', 'T-106'] };
    render(<SpecCard spec={spec} all={allRecipeSpecs} onOpen={vi.fn()} onArchive={vi.fn()} onUnarchive={vi.fn()} onWriteUp={vi.fn()} />);
    expect(screen.queryByText('T-102')).toBeNull();
    expect(screen.getByText('3').style.color).toBe('var(--block-ink)');
  });

  it("a Done card's ⋯ menu offers Archive, which calls onArchive", () => {
    const { onArchive, onOpen } = setup('T-101');
    expect(screen.queryByText('Archive')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Card actions' }));
    fireEvent.click(screen.getByText('Archive'));
    expect(onArchive).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
    expect(screen.queryByText('Archive')).toBeNull();
  });

  it('an archived card is dimmed, labelled, and offers Unarchive', () => {
    const { onUnarchive, card } = setup('T-100');
    expect(screen.getByText('· Archived')).toBeTruthy();
    expect(card.style.opacity).toBe('0.62');
    fireEvent.click(screen.getByRole('button', { name: 'Card actions' }));
    fireEvent.click(screen.getByText('Unarchive'));
    expect(onUnarchive).toHaveBeenCalledTimes(1);
  });

  it('non-done cards have no ⋯ menu', () => {
    setup('T-104');
    expect(screen.queryByRole('button', { name: 'Card actions' })).toBeNull();
  });

  it('clicking the card, and Enter or Space while focused, call onOpen', () => {
    const { card, onOpen } = setup('T-101');
    fireEvent.click(card);
    expect(onOpen).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(onOpen).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(card, { key: ' ' });
    expect(onOpen).toHaveBeenCalledTimes(3);
    fireEvent.keyDown(card, { key: 'a' });
    expect(onOpen).toHaveBeenCalledTimes(3);
  });

  it('View opens once; Enter on an inner button does not open the card', () => {
    const { onOpen } = setup('T-101');
    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Card actions' }), { key: 'Enter' });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('a draft shows the Draft tag and the write-up button, and no progress bar', () => {
    const { onWriteUp, onOpen } = setup('T-107');
    expect(screen.getByText('Draft')).toBeTruthy();
    expect(screen.queryByTitle('Subtasks done')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Have Claude write this up/ }));
    expect(onWriteUp).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('shows progress as done/total, green when complete', () => {
    setup('T-104');
    expect(screen.getByText('2/5')).toBeTruthy();
    cleanup();
    setup('T-101');
    expect(screen.getByText('4/4')).toBeTruthy();
    const fill = screen.getByTitle('Subtasks done').querySelectorAll('div')[1] as HTMLElement;
    expect(fill.style.width).toBe('100%');
    expect(fill.style.background).toBe('var(--done)');
  });

  it('Running shows the active subtask; Review shows the waiting banner', () => {
    setup('T-104', { running: 'Persist planned meals' });
    expect(screen.getByText(/Claude is working/).textContent).toBe('Claude is working · Persist planned meals');
    cleanup();
    setup('T-104', { running: '' });
    expect(screen.getByText('Claude is working')).toBeTruthy();
    cleanup();
    setup('T-103');
    expect(screen.getByText('Waiting on your review')).toBeTruthy();
    expect(screen.queryByText(/Claude is working/)).toBeNull();
  });

  it('the description is the first paragraph of the body', () => {
    setup('T-101');
    expect(screen.getByText(/^A grid of saved recipes/)).toBeTruthy();
  });
});
