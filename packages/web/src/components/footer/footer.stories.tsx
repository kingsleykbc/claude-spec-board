import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { Footer } from './footer';

const meta = { title: 'Shell/Footer', component: Footer } satisfies Meta<typeof Footer>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const footer = within(canvasElement).getByRole('contentinfo');
    // Centred: the links sit in the middle of the page, not at its left edge.
    const box = footer.getBoundingClientRect();
    const link = within(footer).getByRole('link', { name: /^GitHub$/ }).getBoundingClientRect();
    expect(Math.abs(link.left + link.width / 2 - (box.left + box.width / 2))).toBeLessThan(box.width / 4);
  },
};
