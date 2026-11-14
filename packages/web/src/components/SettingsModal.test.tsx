import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApiError } from '../api/client';
import { SettingsModal } from './SettingsModal';

afterEach(cleanup);

function setup(trackTokens: boolean, setSettings = vi.fn(async (_p: string, b: { trackTokens: boolean }) => ({ settings: { trackTokens: b.trackTokens, problems: [] } }))) {
  const props = { pid: 'p1', trackTokens, client: { setSettings }, toast: vi.fn(), onClose: vi.fn() };
  render(<SettingsModal {...props} />);
  return { ...props, setSettings };
}

describe('SettingsModal', () => {
  it('shows the Track tokens switch with its help text', () => {
    setup(true);
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Track tokens' }).getAttribute('aria-checked')).toBe('true');
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

  it('reverts and toasts an error when saving fails', async () => {
    const p = setup(false, vi.fn(async () => Promise.reject(new ApiError(500, 'disk full'))));
    const sw = screen.getByRole('switch', { name: 'Track tokens' });
    fireEvent.click(sw);
    expect(sw.getAttribute('aria-checked')).toBe('true');
    await waitFor(() => expect(sw.getAttribute('aria-checked')).toBe('false'));
    expect(p.toast).toHaveBeenCalledWith('err', 'Could not save the setting', 'disk full');
  });
});
