import path from 'node:path';
import { defineProject } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';

/** Storybook stories as Vitest tests, in headless Chromium (`npm run test:stories`). */
export default defineProject({
  plugins: [react(), tailwindcss(), storybookTest({ configDir: path.join(import.meta.dirname, '.storybook') })],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  test: {
    name: 'storybook',
    browser: {
      enabled: true,
      headless: true,
      provider: 'playwright',
      instances: [{ browser: 'chromium' }],
    },
    setupFiles: ['.storybook/vitest.setup.ts'],
  },
});
