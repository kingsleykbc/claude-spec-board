import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { composeStories } from '@storybook/react-vite';
import { ApiError } from '@/api/client';
import * as stories from './settings-modal.stories';

const { Toggle } = composeStories(stories);

afterEach(cleanup);

type Saved = { settings: { trackTokens: boolean; problems: [] } };

function setup(trackTokens: boolean, setSettings = vi.fn(async (_p: string, b: { trackTokens: boolean }): Promise<Saved> => ({ settings: { trackTokens: b.trackTokens, problems: [] } }))) {
  const props = { trackTokens, client: { setSettings }, toast: vi.fn(), onClose: vi.fn() };
  render(<Toggle {...props} />);
  return { ...props, setSettings };
}

describe('SettingsModal', () => {
  it('shows the Track tokens switch with its help text', () => {
    setup(true);
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeTruthy();
    const sw = screen.getByRole('switch', { name: 'Track tokens' });
    expect(sw.getAttribute('aria-checked')).toBe('true');
    expect(sw.getAttribute('data-slot')).toBe('switch');
    expect(screen.getByText('Record the tokens Claude uses for each subtask in its log. Needs the Spec Board plugin.')).toBeTruthy();
  });

  it('saves immediately on toggle and shows the saved value', async () => {
    const p = setup(true);
    const sw = screen.getByRole('switch', { name: 'Track tokens' });
    fireEvent.click(sw);
    expect(sw.getAttribute('aria-checked')).toBe('false');
    await waitFor(() => expect(p.setSettings).toHaveBeenCalledWith('p1', { trackTokens: false }));
    await waitFor(() => expect(sw.getAttribute('aria-checked')).toBe('false'));
    expect(p.toast).not.toHaveBeenCalled();
  });

  it('is disabled while the save is pending, so a second click cannot race it', async () => {
    let resolve!: (v: Saved) => void;
    const p = setup(
      true,
      vi.fn(() => new Promise<Saved>((r) => (resolve = r))),
    );
    const sw = screen.getByRole('switch', { name: 'Track tokens' });
    fireEvent.click(sw);
    await waitFor(() => expect(sw).toHaveProperty('disabled', true));
    fireEvent.click(sw);
    expect(p.setSettings).toHaveBeenCalledTimes(1);
    await act(async () => resolve({ settings: { trackTokens: false, problems: [] } }));
    await waitFor(() => expect(sw).toHaveProperty('disabled', false));
    expect(sw.getAttribute('aria-checked')).toBe('false');
  });

  it('reverts and toasts an error when saving fails', async () => {
    const p = setup(false, vi.fn(async () => Promise.reject(new ApiError(500, 'disk full'))));
    const sw = screen.getByRole('switch', { name: 'Track tokens' });
    fireEvent.click(sw);
    expect(sw.getAttribute('aria-checked')).toBe('true');
    await waitFor(() => expect(sw.getAttribute('aria-checked')).toBe('false'));
    expect(sw).toHaveProperty('disabled', false);
    expect(p.toast).toHaveBeenCalledWith('err', 'Could not save the setting', 'disk full');
  });
});
