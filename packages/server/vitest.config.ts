import { configDefaults, defineConfig } from 'vitest/config';

// The real-claude test spends the user's subscription, so only `npm run test:claude` runs it.
export default defineConfig({
  test: { exclude: [...configDefaults.exclude, 'test/real-claude.test.ts'] },
});
