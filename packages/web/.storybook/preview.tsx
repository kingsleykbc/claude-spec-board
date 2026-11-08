import type { Preview } from '@storybook/react-vite';
import { useEffect } from 'react';
import '../src/styles/tokens.css';

/** Fonts the app loads from index.html; Storybook needs them too. */
const FONTS = 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap';
if (typeof document !== 'undefined' && !document.querySelector(`link[href="${FONTS}"]`)) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = FONTS;
  document.head.appendChild(link);
}

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Colour theme (sets data-theme on <html>)',
      toolbar: {
        title: 'Theme',
        icon: 'mirror',
        items: [
          { value: 'light', title: 'Light', icon: 'sun' },
          { value: 'dark', title: 'Dark', icon: 'moon' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: 'light' },
  decorators: [
    (Story, ctx) => {
      const theme = ctx.globals.theme === 'dark' ? 'dark' : 'light';
      // Set it during render too, so the very first paint already has the right tokens.
      document.documentElement.dataset.theme = theme;
      useEffect(() => {
        document.documentElement.dataset.theme = theme;
      }, [theme]);
      return (
        <div style={{ background: 'var(--bg)', color: 'var(--fg)', fontFamily: 'var(--sans)', minHeight: '100vh' }}>
          <Story />
        </div>
      );
    },
  ],
  parameters: { layout: 'fullscreen' },
};

export default preview;
