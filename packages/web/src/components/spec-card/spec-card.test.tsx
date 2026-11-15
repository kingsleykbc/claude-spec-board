import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { composeStories } from '@storybook/react-vite';
import * as stories from './spec-card.stories';

const { DefaultDone, Hover, BeingDragged, BlockedQuestions, Running, Writing, InReview, Draft, FileProblem, ManyNeeds, Archived, MenuOpen } =
  composeStories(stories);

afterEach(cleanup);

type Sheet = typeof DefaultDone;

/** Render a story (each shows the card in both themes) and work inside the light one. */
function setup(Story: Sheet, props: Parameters<Sheet>[0] = {}) {
  const fns = { onOpen: vi.fn(), onArchive: vi.fn(), onUnarchive: vi.fn(), onWriteUp: vi.fn() };
  render(<Story {...fns} {...props} />);
  const light = within(screen.getByTestId('theme-light'));
  const card = light.getByRole('button', { name: /^T-\d+ / });
  return { ...fns, light, card };
}

describe('SpecCard', () => {
  it('T-105 shows Blocked; clicking it opens a popover with the reasons, without opening the card', async () => {
    const user = userEvent.setup();
    const { light, onOpen } = setup(BlockedQuestions);
    expect(light.getByText('Blocked')).toBeTruthy();
    expect(screen.queryByText(/3 open questions/)).toBeNull();
    await user.click(light.getByRole('button', { name: 'Why is T-105 blocked?' }));
    const pop = await screen.findByRole('dialog', { name: 'Blocked' });
    expect(within(pop).getByText('3 open questions · Waiting on T-104 (doing)')).toBeTruthy();
    expect(onOpen).not.toHaveBeenCalled();
    await user.click(within(pop).getByText('3 open questions · Waiting on T-104 (doing)'));
    expect(onOpen).not.toHaveBeenCalled();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByText(/3 open questions/)).toBeNull());
  });

  it('shows the first file problem in a popover', async () => {
    const user = userEvent.setup();
    const { light, onOpen } = setup(FileProblem);
    expect(light.getByText(/File problem/)).toBeTruthy();
    await user.click(light.getByRole('button', { name: 'What is wrong with the T-109 file?' }));
    const pop = await screen.findByRole('dialog', { name: 'File problem' });
    expect(within(pop).getByText('The subtask on line 18 is missing its checkbox…')).toBeTruthy();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('the dependency row has a tooltip listing them by name', async () => {
    const user = userEvent.setup();
    const { light } = setup(DefaultDone, { id: 'T-108' });
    await user.hover(light.getByText(/needs/));
    expect((await screen.findByRole('tooltip')).textContent).toContain('Needs: T-106 User accounts (To-do)');
  });

  it("T-108's dependency T-106 uses the block colour and bold", () => {
    const { light } = setup(DefaultDone, { id: 'T-108' });
    const id = light.getByText('T-106');
    expect(id.className).toMatch(/\btext-block-ink\b/);
    expect(id.className).toMatch(/\bfont-semibold\b/);
  });

  it('a done dependency is muted and regular weight', () => {
    const { light } = setup(DefaultDone, { id: 'T-103' }); // needs T-102, which is done
    const id = light.getByText('T-102');
    expect(id.className).toMatch(/\btext-fg3\b/);
    expect(id.className).not.toMatch(/\bfont-semibold\b/);
  });

  it('shows counts instead of IDs when there are more than two', () => {
    const { light } = setup(ManyNeeds);
    expect(light.queryByText('T-102')).toBeNull();
    expect(light.getByText('3').className).toMatch(/\btext-block-ink\b/);
  });

  it("a Done card's ⋯ menu offers Archive, which calls onArchive", () => {
    const { light, onArchive, onOpen } = setup(MenuOpen);
    expect(light.queryByText('Archive')).toBeNull();
    fireEvent.click(light.getByRole('button', { name: 'Card actions' }));
    fireEvent.click(light.getByText('Archive'));
    expect(onArchive).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
    expect(light.queryByText('Archive')).toBeNull();
  });

  it('an archived card is dimmed, labelled, and offers Unarchive', () => {
    const { light, onUnarchive, card } = setup(Archived);
    expect(light.getByText('· Archived')).toBeTruthy();
    expect(card.className).toMatch(/\bopacity-\[0\.62\]/);
    fireEvent.click(light.getByRole('button', { name: 'Card actions' }));
    fireEvent.click(light.getByText('Unarchive'));
    expect(onUnarchive).toHaveBeenCalledTimes(1);
  });

  it('the ⋯ button names itself in a tooltip', async () => {
    const user = userEvent.setup();
    const { light } = setup(DefaultDone);
    await user.hover(light.getByRole('button', { name: 'Card actions' }));
    expect((await screen.findByRole('tooltip')).textContent).toContain('Card actions');
  });

  it('non-done cards have no ⋯ menu', () => {
    const { light } = setup(Running, { running: null });
    expect(light.queryByRole('button', { name: 'Card actions' })).toBeNull();
  });

  it('clicking the card, and Enter or Space while focused, call onOpen', () => {
    const { card, onOpen } = setup(DefaultDone);
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
    const { light, onOpen } = setup(DefaultDone);
    fireEvent.click(light.getByRole('button', { name: 'View' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(light.getByRole('button', { name: 'Card actions' }), { key: 'Enter' });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('a draft shows the Draft tag and the write-up button, and no progress bar', () => {
    const { light, onWriteUp, onOpen } = setup(Draft);
    expect(light.getByText('Draft')).toBeTruthy();
    expect(light.queryByTitle('Subtasks done')).toBeNull();
    fireEvent.click(light.getByRole('button', { name: /Have Claude write this up/ }));
    expect(onWriteUp).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('shows progress as done/total, green when complete', () => {
    let { light } = setup(Running, { running: null });
    expect(light.getByText('2/5')).toBeTruthy();
    cleanup();
    ({ light } = setup(DefaultDone));
    expect(light.getByText('4/4')).toBeTruthy();
    const fill = light.getByTitle('Subtasks done').querySelectorAll('div')[1] as HTMLElement;
    expect(fill.style.width).toBe('100%');
    expect(fill.className).toMatch(/\bbg-done\b/);
  });

  it('Running shows the active subtask; Review shows the waiting banner', () => {
    let { light } = setup(Running);
    expect(light.getByText(/Claude is working/).textContent).toBe('Claude is working · Persist planned meals');
    cleanup();
    ({ light } = setup(Running, { running: '' }));
    expect(light.getByText('Claude is working')).toBeTruthy();
    cleanup();
    ({ light } = setup(InReview));
    expect(light.getByText('Waiting on your review')).toBeTruthy();
    expect(light.queryByText(/Claude is working/)).toBeNull();
  });

  it('writing shows its banner instead of the write-up button', () => {
    const { light } = setup(Writing);
    expect(light.getByText('Claude is writing it up')).toBeTruthy();
    expect(light.queryByRole('button', { name: /Have Claude write this up/ })).toBeNull();
  });

  it('the description is the first paragraph of the body', () => {
    const { light } = setup(DefaultDone);
    expect(light.getByText(/^A grid of saved recipes/)).toBeTruthy();
  });

  it('hover and lifted looks', () => {
    let { card } = setup(Hover);
    expect(card.className).toMatch(/\bbg-raise\b/);
    cleanup();
    ({ card } = setup(BeingDragged));
    expect(card.getAttribute('data-lifted')).toBe('true');
    expect(card.className).toMatch(/rotate-\[-1\.8deg\]/);
  });
});
