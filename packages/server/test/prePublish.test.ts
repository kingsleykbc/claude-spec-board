import { describe, expect, it } from 'vitest';
import { boardCommand, initHint, nextLine } from '../src/prePublish.js';

describe('CLI hints by mode', () => {
  it('from the repo, point at the repo scripts', () => {
    expect(initHint('/p', false)).toContain('npm run specboard -- init "/p"');
    expect(boardCommand('/p', false)).toBe('npm run board -- "/p"');
    expect(nextLine('/p', false)).toBe('Next, from the Spec Board repo, open the board: npm run board -- "/p"');
  });

  it('from the plugin bundle, never mention the repo', () => {
    expect(initHint('/p', true)).toBe('Ask Claude to run /specboard:setup, or to run `specboard init --yes --no-skills --runs yes "/p"`.');
    expect(boardCommand('/p', true)).toBe('specboard "/p"');
    expect(nextLine('/p', true)).toBe('Open the board with `specboard "/p"`.');
    for (const s of [initHint('/p', true), nextLine('/p', true)]) expect(s).not.toMatch(/repo|npm run/);
  });

  it('from source, the default is the repo wording', () => {
    expect(nextLine('/p')).toBe(nextLine('/p', false));
  });
});
