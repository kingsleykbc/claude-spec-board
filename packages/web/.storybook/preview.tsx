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
          {/* The app shell's base type (App.tsx), so a story looks as it does on the board. */}
          <div className="min-h-screen bg-bg font-sans text-fg">
            <Story />
          </div>
        </TooltipProvider>
      );
    },
  ],
  parameters: { layout: 'fullscreen' },
};

export default preview;
