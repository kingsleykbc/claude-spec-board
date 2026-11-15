import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { DocsPage } from './docs-page';

const projects = [
  { id: 'a1', name: 'Recipe Box', root: 'C:/p/recipe-box', available: true, progress: { done: 3, total: 9 } },
  { id: 'b2', name: 'Other', root: 'C:/p/other', available: true, progress: { done: 0, total: 0 } },
];

const meta = {
  title: 'Pages/Docs',
  component: DocsPage,
  args: { pathname: '/docs', loadProjects: async () => projects, go: fn() },
} satisfies Meta<typeof DocsPage>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The README, with every page in the nav. */
export const Readme: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    expect(c.getByRole('heading', { name: 'Spec Board', level: 2 })).toBeTruthy();
    expect(within(c.getByRole('navigation', { name: 'Documentation' })).getByRole('link', { name: 'Overview' }).getAttribute('aria-current')).toBe('page');
  },
};

export const RunningSpecs: Story = {
  args: { pathname: '/docs/running-specs' },
  play: async ({ canvasElement }) => {
    expect(within(canvasElement).getByRole('heading', { name: 'Running a spec', level: 2 })).toBeTruthy();
  },
};

/** The server isn't running: the docs still read fine, without a project switcher. */
export const Offline: Story = {
  args: { loadProjects: () => Promise.reject(new Error('offline')) },
  play: async ({ canvasElement }) => {
    expect(within(canvasElement).getByRole('link', { name: 'Open the board' }).getAttribute('href')).toBe('/');
  },
};
