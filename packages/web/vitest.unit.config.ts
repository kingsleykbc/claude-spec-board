import { defineProject } from 'vitest/config';
import react from '@vitejs/plugin-react';

/** Unit tests in happy-dom (`npm test`). Kept apart from the Storybook project so it never loads Storybook. */
export default defineProject({
  plugins: [react()],
  test: {
    name: 'unit',
    environment: 'happy-dom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
