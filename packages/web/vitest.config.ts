import { defineConfig } from 'vitest/config';

/** Both Vitest projects, for `npx vitest --project <unit|storybook>` and Storybook's test panel. */
export default defineConfig({
  test: {
    projects: ['./vitest.unit.config.ts', './vitest.storybook.config.ts'],
  },
});
