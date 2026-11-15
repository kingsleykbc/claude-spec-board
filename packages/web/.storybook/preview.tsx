import type { Preview } from '@storybook/react-vite';
import { useEffect } from 'react';
import '../src/styles/app.css';
import { TooltipProvider } from '../src/components/ui/tooltip/tooltip';

// Fonts come from preview-head.html (a <link> added here would be fetched by happy-dom in unit tests).

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
        <TooltipProvider>
          <div style={{ background: 'var(--bg)', color: 'var(--fg)', fontFamily: 'var(--sans)', minHeight: '100vh' }}>
            <Story />
          </div>
        </TooltipProvider>
      );
    },
  ],
  parameters: { layout: 'fullscreen' },
};

export default preview;
