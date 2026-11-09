import { defineConfig } from 'vitest/config';

// `npm run test:claude`: runs against the real `claude` and uses the logged-in subscription.
export default defineConfig({
  test: {
    include: ['test/real-claude.test.ts'],
    env: { SPECBOARD_REAL_CLAUDE: '1' },
    testTimeout: 600_000,
    hookTimeout: 120_000,
    reporters: ['verbose'],
  },
});
