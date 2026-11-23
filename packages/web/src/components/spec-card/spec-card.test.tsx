import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { composeStories } from '@storybook/react-vite';
import * as stories from './spec-card.stories';
import { recipeSpec } from '@/fixtures/recipeBox';
import { firstParagraph } from '@/lib/vm';

const {
  DefaultDone,
  Hover,
  BeingDragged,
  BlockedQuestions,
  Running,
  Chat,
  Writing,
  InReview,
  Draft,
  DraftNotConnected,
  FileProblem,
  ManyNeeds,
  Archived,
  MenuOpen,
  MenuNarrow,
  SimpleBlocked,
  SimpleBlockedNarrow,
} = composeStories(stories);

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

  it("a Done card's ⋯ menu offers Archive, which calls onArchive", async () => {
    const user = userEvent.setup();
    const { light, onArchive, onOpen } = setup(MenuOpen);
    expect(screen.queryByText('Archive')).toBeNull();
    await user.click(light.getByRole('button', { name: 'Card actions' }));
    expect(onOpen).not.toHaveBeenCalled();
    await user.click(await screen.findByRole('menuitem', { name: 'Archive' }));
    expect(onArchive).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText('Archive')).toBeNull());
  });

  it('the ⋯ menu closes on Escape and on a click outside, without opening the card', async () => {
    const user = userEvent.setup();
    const { light, onOpen } = setup(MenuOpen);
    const trigger = light.getByRole('button', { name: 'Card actions' });
    await user.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('menuitem', { name: 'Archive' })).toBeNull());
    await user.click(trigger);
    expect(await screen.findByRole('menuitem', { name: 'Archive' })).toBeTruthy();
    await user.click(document.body);
    await waitFor(() => expect(screen.queryByRole('menuitem', { name: 'Archive' })).toBeNull());
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('narrow: the ⋯ menu opens as a bottom drawer, and Archive still works', async () => {
    const user = userEvent.setup();
    const { light, onArchive, onOpen } = setup(MenuNarrow);
    await user.click(light.getByRole('button', { name: 'Card actions' }));
    const sheet = await screen.findByRole('dialog', { name: 'Card actions' });
    expect(within(sheet).getByRole('menu', { name: 'Card actions' })).toBeTruthy();
    await user.click(within(sheet).getByRole('menuitem', { name: 'Archive' }));
    expect(onArchive).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('Simple mode: the ⋯ details sit in a dropdown on wide screens and a drawer on narrow ones', async () => {
    const user = userEvent.setup();
    let { light, onOpen } = setup(SimpleBlocked);
    await user.click(light.getByRole('button', { name: 'More about T-105' }));
    const menu = await screen.findByRole('menu', { name: 'More about T-105' });
    expect(within(menu).getByTestId('card-details').textContent).toContain('3 open questions · Waiting on T-104 (doing)');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onOpen).not.toHaveBeenCalled();
    cleanup();
    ({ light, onOpen } = setup(SimpleBlockedNarrow));
    await user.click(light.getByRole('button', { name: 'More about T-105' }));
    const sheet = await screen.findByRole('dialog', { name: 'More about T-105' });
    expect(within(sheet).getByText('3 open questions · Waiting on T-104 (doing)')).toBeTruthy();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('an archived card is dimmed, labelled, and offers Unarchive', async () => {
    const user = userEvent.setup();
    const { light, onUnarchive, card } = setup(Archived);
    expect(light.getByText('· Archived')).toBeTruthy();
    expect(card.className).toMatch(/\bopacity-\[0\.62\]/);
    await user.click(light.getByRole('button', { name: 'Card actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Unarchive' }));
    expect(onUnarchive).toHaveBeenCalledTimes(1);
  });

  it('the ⋯ button names itself in a tooltip', async () => {
    const user = userEvent.setup();
    const { light } = setup(DefaultDone);
    await user.hover(light.getByRole('button', { name: 'Card actions' }));
    expect((await screen.findByRole('tooltip')).textContent).toContain('Card actions');
  });

  it('a card in any column has Archive in its ⋯ menu', async () => {
    const { light, onArchive } = setup(Running, { running: null });
    await userEvent.click(light.getByRole('button', { name: 'Card actions' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Archive' }));
    expect(onArchive).toHaveBeenCalledTimes(1);
  });

  it('an archived card offers Unarchive instead', async () => {
    const { light, onUnarchive } = setup(Archived);
    await userEvent.click(light.getByRole('button', { name: 'Card actions' }));
    expect(screen.queryByRole('menuitem', { name: 'Archive' })).toBeNull();
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Unarchive' }));
    expect(onUnarchive).toHaveBeenCalledTimes(1);
  });

  it('not connected: the draft write-up button is greyed, not disabled, and opens the command to paste without opening the card', async () => {
    const { light, onWriteUp, onOpen } = setup(DraftNotConnected);
    const btn = light.getByRole('button', { name: 'Have Claude write this up' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    expect(btn.className).not.toMatch(/bg-accent/);
    await userEvent.click(btn);
    const pop = await screen.findByRole('dialog', { name: "Claude isn’t connected" });
    expect(pop.textContent).toMatch('/specboard:create-spec T-107');
    expect(onWriteUp).not.toHaveBeenCalled();
    expect(onOpen).not.toHaveBeenCalled();
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
    // Nor does a click on the ⋯ trigger (a card control).
    fireEvent.click(light.getByRole('button', { name: 'Card actions' }));
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

  it('a chat shows which step Claude is working on', () => {
    const { light } = setup(Chat);
    expect(light.getByText('Claude is working on step 2 in a chat')).toBeTruthy();
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

describe('SpecCard description', () => {
  it('renders inline Markdown instead of showing the raw asterisks (T-103)', () => {
    const { light } = setup(InReview);
    const root = screen.getByTestId('theme-light');
    expect(root.textContent).not.toContain('**');
    expect(light.getByText('tags').tagName).toBe('STRONG');
  });
});

describe('SpecCard in Simple mode', () => {
  it('full mode still shows everything (T-105)', () => {
    const { light } = setup(BlockedQuestions);
    expect(light.getByText('Blocked')).toBeTruthy();
    expect(light.getByText(firstParagraph(recipeSpec('T-105').bodyMd))).toBeTruthy();
    expect(screen.getByTestId('theme-light').querySelector('[data-urgency]')).not.toBeNull();
    expect(light.getByText('Backend')).toBeTruthy();
    expect(light.getByText(/needs/)).toBeTruthy();
    expect(light.getByRole('button', { name: 'View' })).toBeTruthy();
    expect(light.queryByRole('button', { name: 'More about T-105' })).toBeNull();
  });

  it('shows the ID, title, the start of the description and progress; the rest is behind ⋯, with a dot for a blocked spec', async () => {
    const { light, onOpen } = setup(SimpleBlocked);
    expect(light.getByText('Shopping list export')).toBeTruthy();
    expect(light.queryByText('Blocked')).toBeNull();
    expect(light.getByText(firstParagraph(recipeSpec('T-105').bodyMd))).toBeTruthy();
    expect(screen.getByTestId('theme-light').querySelector('[data-urgency]')).toBeNull();
    expect(light.queryByText('Backend')).toBeNull();
    expect(light.queryByText(/needs/)).toBeNull();
    expect(light.queryByRole('button', { name: 'View' })).toBeNull();
    expect(light.getByTestId('card-attention')).toBeTruthy();

    await userEvent.click(light.getByRole('button', { name: 'More about T-105' }));
    expect(onOpen).not.toHaveBeenCalled();
    const d = within(screen.getByTestId('card-details'));
    expect(d.getByText('Blocked')).toBeTruthy();
    expect(d.getByText('3 open questions · Waiting on T-104 (doing)')).toBeTruthy();
    expect(d.getByText('Urgency')).toBeTruthy();
    expect(d.getByText('Normal')).toBeTruthy();
    expect(d.getByText('Backend')).toBeTruthy();
    expect(d.getByText('Needs')).toBeTruthy();
    expect(d.getByText('T-104')).toBeTruthy();
  });

  it('no dot when nothing needs a look; a review card says so in the menu', async () => {
    const { light } = setup(SimpleBlocked, { id: 'T-103' });
    expect(light.queryByTestId('card-attention')).toBeNull();
    expect(light.queryByText('Waiting on your review')).toBeNull();
    await userEvent.click(light.getByRole('button', { name: 'More about T-103' }));
    expect(within(screen.getByTestId('card-details')).getByText('Waiting on your review')).toBeTruthy();
  });

  it('a file problem moves into the menu too', async () => {
    const { light } = setup(SimpleBlocked, { id: 'T-109' });
    expect(light.queryByText(/File problem/)).toBeNull();
    expect(light.getByTestId('card-attention')).toBeTruthy();
    await userEvent.click(light.getByRole('button', { name: 'More about T-109' }));
    expect(within(screen.getByTestId('card-details')).getByText('File problem')).toBeTruthy();
  });

  it('a done card keeps Archive in the same menu', async () => {
    const { light, onArchive } = setup(SimpleBlocked, { id: 'T-102' });
    await userEvent.click(light.getByRole('button', { name: 'More about T-102' }));
    expect(screen.getByTestId('card-details')).toBeTruthy();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Archive' }));
    expect(onArchive).toHaveBeenCalled();
  });

  it('a draft keeps "Have Claude write this up"', () => {
    const { light, onWriteUp } = setup(SimpleBlocked, { id: 'T-107' });
    fireEvent.click(light.getByRole('button', { name: 'Have Claude write this up' }));
    expect(onWriteUp).toHaveBeenCalled();
  });
});
