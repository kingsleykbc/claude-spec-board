import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { SettingsModal } from './SettingsModal';

const meta = {
  title: 'Modals/Settings',
  component: SettingsModal,
  args: { pid: 'p1', trackTokens: true, toast: fn(), onClose: fn() },
} satisfies Meta<typeof SettingsModal>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Toggle: Story = {
  args: { client: { setSettings: fn(async (_p: string, b: { trackTokens: boolean }) => ({ settings: { trackTokens: b.trackTokens, problems: [] } })) } },
  play: async ({ canvasElement, args }) => {
    const sw = await within(canvasElement).findByRole('switch', { name: 'Track tokens' });
    expect(sw.getAttribute('aria-checked')).toBe('true');
    await userEvent.click(sw);
    await waitFor(() => expect(args.client!.setSettings).toHaveBeenCalledWith('p1', { trackTokens: false }));
    expect(sw.getAttribute('aria-checked')).toBe('false');
  },
};

export const SaveFails: Story = {
  args: { client: { setSettings: fn(async () => Promise.reject(new Error('Disk is read only'))) } },
  play: async ({ canvasElement, args }) => {
    const sw = await within(canvasElement).findByRole('switch', { name: 'Track tokens' });
    await userEvent.click(sw);
    await waitFor(() => expect(args.toast).toHaveBeenCalledWith('err', 'Could not save the setting', 'Disk is read only'));
    expect(sw.getAttribute('aria-checked')).toBe('true');
  },
};
