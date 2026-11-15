import { useEffect, useState, type ReactNode } from 'react';
import type { Decorator } from '@storybook/react-vite';

/** Pretends the window is 720px or narrower, so `useNarrow()` is true while the story is shown. */
export function NarrowScreen({ children }: { children: ReactNode }) {
  const [real] = useState(() => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: /max-width:\s*720px/.test(query),
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    return original;
  });
  useEffect(() => () => void (window.matchMedia = real), [real]);
  return children;
}

/** Story decorator: render the story as on a narrow screen. */
export const narrow: Decorator = (Story) => <NarrowScreen>{Story()}</NarrowScreen>;
