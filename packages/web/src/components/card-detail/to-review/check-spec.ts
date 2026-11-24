import type { Spec } from '@specboard/core';
import { recipeSpec } from '@/fixtures/recipeBox';

// Sample data for the To review stories and tests.

/** T-103 in Review with How to check steps on every item, one failed check and one fixed earlier. */
export const checkSpec = (): Spec => {
  const base = recipeSpec('T-103');
  const [a, b, c] = base.reviews;
  return {
    ...base,
    status: 'review',
    reviews: [
      { ...a!, steps: ['Run `npm run dev` in the project folder.', 'Open [the recipes page](http://localhost:5173/recipes).', 'Type "pasta" into the **Search** box.'] },
      { ...b!, steps: ['Clear the **Search** box.'], failed: 'The list stays empty until I reload.' },
      { ...c!, steps: ['Pick **Under 30 min** in the filters.', 'Press the reload button.', 'Ignore [this](javascript:alert(1)) link.'], fixed: ['The filter reset on reload (a1b2c3d)'] },
    ],
  };
};
