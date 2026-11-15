import path from 'node:path';
import { defineProject } from 'vitest/config';
import react from '@vitejs/plugin-react';

/** Unit tests in happy-dom (`npm test`). Kept apart from the Storybook project so it never loads Storybook. */
export default defineProject({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  test: {
    name: 'unit',
    environment: 'happy-dom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
  },
});
