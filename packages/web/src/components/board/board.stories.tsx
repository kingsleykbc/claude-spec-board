import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, userEvent, waitFor, within } from 'storybook/test';
import { Board } from './board';
import { recipeArchived, recipeSpecs } from '@/fixtures/recipeBox';
import { NO_FILTERS } from '@/state/filters';

/** The sample's milestone list (examples/recipe-box/.specboard/config.md). */
const SAMPLE_MILESTONES = ['Basics', 'Planning'];

const meta = {
  title: 'Shell/Board',
  component: Board,
  args: {
    specs: recipeSpecs,
    archived: recipeArchived,
    canDrag: true,
    onMove: fn(),
    onOpen: fn(),
    onArchive: fn(),
    onUnarchive: fn(),
    onWriteUp: fn(),
    onAdd: fn(),
  },
} satisfies Meta<typeof Board>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    expect(c.getByText('Needs you')).toBeTruthy();
    // Drag T-104 from Doing onto Review with real pointer events (dnd-kit PointerSensor).
    const card = c.getByRole('button', { name: /^T-104 / });
    const r = card.getBoundingClientRect();
    const from = { clientX: r.left + 40, clientY: r.top + 20 };
    const col = c.getByRole('region', { name: 'Review' }).getBoundingClientRect();
    const to = { clientX: col.left + 40, clientY: col.top + 300 };
    const o = { isPrimary: true, button: 0, pointerId: 1, bubbles: true };
    fireEvent.pointerDown(card, { ...o, ...from });
    fireEvent.pointerMove(document, { ...o, clientX: from.clientX + 10, clientY: from.clientY + 10 });
    fireEvent.pointerMove(document, { ...o, ...to });
    await waitFor(() => expect(c.getByText('Drop to move to Review')).toBeTruthy());
    fireEvent.pointerUp(document, { ...o, ...to });
    await waitFor(() => expect(args.onMove).toHaveBeenCalledWith(expect.objectContaining({ id: 'T-104' }), 'review'));
    // dnd-kit swallows clicks on the document for 50 ms after a drop; don't leak that into the next story.
    await new Promise((r) => setTimeout(r, 80));
  },
};

export const ArchivedShown: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    fireEvent.click(c.getByRole('button', { name: 'Show archived (1)' }));
    expect(c.getByRole('button', { name: /^T-100 / })).toBeTruthy();
  },
};

/** The board on the Basics milestone: the archived scaffold (T-100, Basics) counts and shows. */
export const MilestoneBasics: Story = {
  args: { milestones: SAMPLE_MILESTONES, filters: { ...NO_FILTERS, milestone: 'Basics' } },
  play: async ({ canvasElement }) => {
    const done = within(within(canvasElement).getByRole('region', { name: 'Done' }));
    expect(done.queryByText('Project scaffold')).toBeNull();
    await userEvent.click(done.getByRole('button', { name: 'Show archived (1)' }));
    expect(done.getByText('Project scaffold')).toBeTruthy();
    expect(done.getByRole('button', { name: 'Hide archived (1)' })).toBeTruthy();
  },
};

/** The board on the Planning milestone: no archived spec is in it, so the Done column has no toggle. */
export const MilestonePlanning: Story = {
  args: { milestones: SAMPLE_MILESTONES, filters: { ...NO_FILTERS, milestone: 'Planning' } },
  play: async ({ canvasElement }) => {
    const done = within(within(canvasElement).getByRole('region', { name: 'Done' }));
    expect(done.queryByRole('button', { name: /archived/ })).toBeNull();
  },
};

/** Blocked only hides unblocked live cards, but archived specs still count (a finished spec is never blocked). */
export const BlockedOnly: Story = {
  args: { milestones: SAMPLE_MILESTONES, filters: { ...NO_FILTERS, blocked: true } },
  play: async ({ canvasElement }) => {
    const done = within(within(canvasElement).getByRole('region', { name: 'Done' }));
    expect(done.getByRole('button', { name: 'Show archived (1)' })).toBeTruthy();
  },
};

export const Disconnected: Story = {
  args: { canDrag: false },
  play: async ({ canvasElement }) => {
    expect(within(canvasElement).getByRole('button', { name: /^T-104 / }).getAttribute('aria-disabled')).toBe('true');
  },
};

export const EmptyProject: Story = {
  args: { specs: [], archived: [] },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    expect(c.getByText('No specs yet')).toBeTruthy();
    expect(c.getByText('Nothing to do')).toBeTruthy();
    expect(c.getByText('Nothing done yet')).toBeTruthy();
  },
};
