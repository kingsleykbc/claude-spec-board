import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { THEME_KEY, resolveTheme, savedThemeChoice } from './theme';

// The inline script in index.html that sets the theme before first paint.
const html = readFileSync(path.resolve(import.meta.dirname, '../../index.html'), 'utf8');
const inline = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '';

function boot(saved: string | null, osDark: boolean): string | undefined {
  document.documentElement.removeAttribute('data-theme');
  try {
    localStorage.clear();
    if (saved !== null) localStorage.setItem(THEME_KEY, saved);
  } catch {
    // no storage
  }
  vi.spyOn(window, 'matchMedia').mockImplementation((q: string) => ({ matches: osDark && q === '(prefers-color-scheme: dark)', media: q }) as MediaQueryList);
  new Function(inline)();
  return document.documentElement.dataset.theme;
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('index.html theme boot script', () => {
  it('is an inline classic script in <head>, before the stylesheets', () => {
    expect(inline).toContain(`'${THEME_KEY}'`);
    const head = html.slice(0, html.indexOf('</head>'));
    expect(head.indexOf('<script>')).toBeGreaterThan(-1);
    expect(head.indexOf('<script>')).toBeLessThan(head.indexOf('rel="stylesheet"'));
  });

  it('matches lib/theme for every saved choice and OS setting', () => {
    for (const saved of [null, 'light', 'dark', 'system', 'bogus'])
      for (const osDark of [false, true]) {
        const got = boot(saved, osDark);
        expect(got, `saved=${saved} osDark=${osDark}`).toBe(resolveTheme(savedThemeChoice()));
      }
    expect(boot(null, true)).toBe('dark');
    expect(boot('light', true)).toBe('light');
  });

  it('falls back to System when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(window, 'matchMedia').mockImplementation((q: string) => ({ matches: true, media: q }) as MediaQueryList);
    document.documentElement.removeAttribute('data-theme');
    new Function(inline)();
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});
