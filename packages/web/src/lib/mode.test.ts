import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api/client', () => ({ api: { health: vi.fn() } }));

import { api } from '../api/client';
import { isPluginMode, loadMode, resetMode } from './mode';
import { allowHint, initHint } from './prePublish';

afterEach(() => {
  resetMode();
  vi.mocked(api.health).mockReset();
});

describe('plugin mode', () => {
  it('reads /api/health once and switches the hints to the plugin wording', async () => {
    vi.mocked(api.health).mockResolvedValue({ ok: true, app: 'specboard', plugin: true });
    expect(isPluginMode()).toBe(false);
    await Promise.all([loadMode(), loadMode()]);
    expect(api.health).toHaveBeenCalledTimes(1);
    expect(isPluginMode()).toBe(true);
    expect(initHint('/p')).toBe('Ask Claude to run /specboard:setup again to update the allowed commands.');
    expect(allowHint('/p')).toBe('Ask Claude to run /specboard:setup again to update the allowed commands, or ask Claude to run `specboard init --yes --no-skills --runs yes "/p"`.');
  });

  it('keeps the repo wording for a repo server, an old server and a failed call', async () => {
    for (const answer of [Promise.resolve({ ok: true, app: 'specboard', plugin: false }), Promise.resolve({ ok: true, app: 'specboard' }), Promise.reject(new Error('down'))]) {
      resetMode();
      vi.mocked(api.health).mockReturnValue(answer);
      await loadMode();
      expect(isPluginMode()).toBe(false);
      expect(initHint('/p')).toBe('Run `specboard init` in a terminal. Until Spec Board is published, run it from the Spec Board repo as `npm run specboard -- init "/p"`.');
      expect(allowHint('/p')).toContain('npm run specboard -- allow "<rule>" "/p"');
    }
  });
});
