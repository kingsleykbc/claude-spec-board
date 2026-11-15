import { useLayoutEffect, useState, type ReactNode } from 'react';
import type { Decorator } from '@storybook/react-vite';

/** Answers a `(max-width: Npx)` media query as a window `width` pixels wide would; any other query is false. */
function fakeMatch(width: number, query: string): boolean {
  const max = /max-width:\s*(\d+)px/.exec(query);
  return max ? width <= Number(max[1]) : false;
}

/**
 * Pretends the window is `width` pixels wide (720 by default, so `useNarrow()` is true) while the story is shown.
 * The swap happens in a layout effect, not during render, and the effect's cleanup always puts the real
 * matchMedia back. The story renders only after the swap (still before paint), so it never sees the wide answer.
 */
export function NarrowScreen({ children, width = 720 }: { children: ReactNode; width?: number }) {
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    const real = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: fakeMatch(width, query),
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    setReady(true);
    return () => {
      window.matchMedia = real;
    };
  }, [width]);
  return ready ? children : null;
}

/** Story decorator: render the story as on a narrow screen (720px). */
export const narrow: Decorator = (Story) => <NarrowScreen>{Story()}</NarrowScreen>;

/** Story decorator: media queries see a window `width` pixels wide (e.g. 721, just above the narrow boundary). */
export const screenWidth =
  (width: number): Decorator =>
  (Story) => <NarrowScreen width={width}>{Story()}</NarrowScreen>;
