import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { Toasts } from './toasts';
import type { Toast } from '@/state/toasts';

// The prototype's sheet toasts (line 818), plus run/info/warn so every kind shows.
const ALL: Toast[] = [
  { id: 1, kind: 'ok', text: 'T-104 moved to Review', sub: 'Claude finished. Have a look when you can.' },
  { id: 2, kind: 'run', text: 'Claude started on T-103', sub: 'Search & filters' },
  { id: 3, kind: 'info', text: 'Run spec-board in a project folder', sub: 'It will appear in this list.' },
  { id: 4, kind: 'warn', text: 'Claude needs an answer on T-105' },
  { id: 5, kind: 'err', text: 'Couldn’t save T-105', sub: 'The file is read-only. Check its permissions.' },
];

const meta = { title: 'UI/Toasts', component: Toasts, args: { toasts: ALL, onDismiss: fn() } } satisfies Meta<typeof Toasts>;
export default meta;
type Story = StoryObj<typeof meta>;

export const AllKinds: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    // Each kind has its own icon.
    const icons = [...canvasElement.querySelectorAll('[data-kind] > span:first-child')].map((x) => x.innerHTML);
    expect(icons).toHaveLength(5);
    expect(new Set(icons).size).toBe(5);
    expect(c.getAllByRole('button', { name: 'Dismiss' })).toHaveLength(5);
  },
};

/** One success toast with a second line, and one error. */
export const Two: Story = {
  args: {
    toasts: [
      { id: 1, kind: 'ok', text: 'T-104 moved to Review', sub: 'Meal planner calendar' },
      { id: 2, kind: 'err', text: 'Couldn’t move T-105' },
    ],
  },
};
