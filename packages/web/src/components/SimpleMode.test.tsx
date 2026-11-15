import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import userEvent from '@testing-library/user-event';
import { allRecipeSpecs, recipeArchived, recipeSpec, recipeSpecs } from '../fixtures/recipeBox';
import { firstParagraph } from '../lib/vm';
import { createMutator } from '../state/mutate';
import { initialSimple, saveSimple, SIMPLE_KEY, SimpleMode } from '../state/simpleMode';
import { CardDetail } from './card-detail/card-detail';
import { SpecCard } from './spec-card/spec-card';
import { TooltipProvider } from './ui/tooltip/tooltip';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

const simpleWrap = ({ children }: { children: ReactNode }) => (
  <TooltipProvider>
    <SimpleMode value>{children}</SimpleMode>
  </TooltipProvider>
);
/** Cards carry tooltips (the ⋯ button, the dependency row); the app gives them a provider. */
const fullWrap = ({ children }: { children: ReactNode }) => <TooltipProvider>{children}</TooltipProvider>;

function card(id: string, simple: boolean) {
  const fns = { onOpen: vi.fn(), onArchive: vi.fn(), onUnarchive: vi.fn(), onWriteUp: vi.fn() };
  render(<SpecCard spec={recipeSpec(id)} all={allRecipeSpecs} {...fns} />, { wrapper: simple ? simpleWrap : fullWrap });
  return fns;
}

describe('Simple mode: the switch is remembered', () => {
  it('is off until turned on, and stays on for the next visit', () => {
    expect(initialSimple()).toBe(false);
    saveSimple(true);
    expect(localStorage.getItem(SIMPLE_KEY)).toBe('on');
    expect(initialSimple()).toBe(true);
    saveSimple(false);
    expect(initialSimple()).toBe(false);
  });

  it('blocked storage means off, and saving does not throw', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(initialSimple()).toBe(false);
    expect(() => saveSimple(true)).not.toThrow();
  });
});

describe('Simple mode: cards', () => {
  it('full mode still shows everything (T-105)', () => {
    card('T-105', false);
    expect(screen.getByText('Blocked')).toBeTruthy();
    expect(screen.getByText(firstParagraph(recipeSpec('T-105').bodyMd))).toBeTruthy();
    expect(document.querySelector('[data-urgency]')).not.toBeNull();
    expect(screen.getByText('Backend')).toBeTruthy();
    expect(screen.getByText(/needs/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'View' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'More about T-105' })).toBeNull();
  });

  it('shows the ID, title, the start of the description and progress; the rest is behind ⋯, with a dot for a blocked spec', async () => {
    const { onOpen } = card('T-105', true);
    expect(screen.getByText('Shopping list export')).toBeTruthy();
    expect(screen.queryByText('Blocked')).toBeNull();
    expect(screen.getByText(firstParagraph(recipeSpec('T-105').bodyMd))).toBeTruthy();
    expect(document.querySelector('[data-urgency]')).toBeNull();
    expect(screen.queryByText('Backend')).toBeNull();
    expect(screen.queryByText(/needs/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'View' })).toBeNull();
    expect(screen.getByTestId('card-attention')).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'More about T-105' }));
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
    card('T-103', true);
    expect(screen.queryByTestId('card-attention')).toBeNull();
    expect(screen.queryByText('Waiting on your review')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'More about T-103' }));
    expect(within(screen.getByTestId('card-details')).getByText('Waiting on your review')).toBeTruthy();
  });

  it('a file problem moves into the menu too', async () => {
    card('T-109', true);
    expect(screen.queryByText(/File problem/)).toBeNull();
    expect(screen.getByTestId('card-attention')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'More about T-109' }));
    expect(within(screen.getByTestId('card-details')).getByText('File problem')).toBeTruthy();
  });

  it('a done card keeps Archive in the same menu', async () => {
    const { onArchive } = card('T-102', true);
    await userEvent.click(screen.getByRole('button', { name: 'More about T-102' }));
    expect(screen.getByTestId('card-details')).toBeTruthy();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Archive' }));
    expect(onArchive).toHaveBeenCalled();
  });

  it('a draft keeps "Have Claude write this up"', () => {
    const { onWriteUp } = card('T-107', true);
    fireEvent.click(screen.getByRole('button', { name: 'Have Claude write this up' }));
    expect(onWriteUp).toHaveBeenCalled();
  });
});

describe('Simple mode: the card detail', () => {
  function detail(id: string, simple: boolean) {
    const onOpenSpec = vi.fn();
    const onClose = vi.fn();
    render(
      <CardDetail
        pid="p1"
        specId={id}
        root="examples/recipe-box"
        specs={recipeSpecs}
        archived={recipeArchived}
        mutate={createMutator(() => Promise.reject(new Error('no default')))}
        refresh={async () => undefined}
        toast={vi.fn()}
        onMove={vi.fn()}
        onClose={onClose}
        onOpenSpec={onOpenSpec}
      />,
      { wrapper: simple ? simpleWrap : fullWrap },
    );
    return { onOpenSpec, onClose };
  }

  it('full mode shows urgency, categories and the Dependencies section, and no ⋯', () => {
    detail('T-105', false);
    expect(screen.getByRole('radiogroup', { name: 'Urgency' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Dependencies' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'More details' })).toBeNull();
  });

  it('Simple mode moves urgency, categories and dependencies into ⋯ More details', () => {
    const { onOpenSpec } = detail('T-105', true);
    expect(screen.queryByRole('radiogroup', { name: 'Urgency' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Dependencies' })).toBeNull();
    expect(screen.queryByText('Backend')).toBeNull();
    // The rest of the detail is unchanged.
    expect(screen.getByRole('heading', { level: 1, name: 'Shopping list export' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Copy run command/ })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'More details' }));
    const menu = within(screen.getByRole('dialog', { name: 'More details' }));
    expect(menu.getByRole('radiogroup', { name: 'Urgency' })).toBeTruthy();
    expect(menu.getByText('Backend')).toBeTruthy();
    expect(menu.getByText('Depends on')).toBeTruthy();
    fireEvent.click(menu.getByRole('button', { name: /T-104/ }));
    expect(onOpenSpec).toHaveBeenCalledWith('T-104');
  });

  it('Esc closes the ⋯ menu before the detail', () => {
    const { onClose } = detail('T-105', true);
    fireEvent.click(screen.getByRole('button', { name: 'More details' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'More details' })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('the blocked reason about a dependency opens the ⋯ menu', () => {
    detail('T-105', true);
    fireEvent.click(screen.getByRole('button', { name: /Waiting on T-104/ }));
    expect(screen.getByRole('dialog', { name: 'More details' })).toBeTruthy();
  });
});
