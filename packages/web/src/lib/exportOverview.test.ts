import { describe, expect, it } from 'vitest';
import { recipeProject } from '../fixtures/recipeBox';
import { exportOverview, overviewCounts } from './exportOverview';

describe('exportOverview', () => {
  it('names the file after the project and writes heading, description, counts and summary', () => {
    const { filename, text } = exportOverview(recipeProject);
    expect(filename).toBe('recipe-box-overview.md');
    expect(text.startsWith('# Recipe Box\n\n')).toBe(true);
    expect(text).toContain('- Done: 3');
    expect(text).toBe(
      '# Recipe Box\n\n' +
        "A web app to save recipes, plan the week's meals and turn the plan into a shopping list.\n\n" +
        '## Counts\n- To-do: 4\n- Doing: 1\n- Review: 1\n- Done: 3\n- Blocked: 2\n\n' +
        `## Progress\n${recipeProject.overview!.summaryMd}\n`,
    );
  });

  it('counts archived as done, and blocked only for active, non-done specs', () => {
    const blockedDone = { ...recipeProject.specs[0]!, blocked: true };
    const blockedArchived = { ...recipeProject.archived[0]!, blocked: true };
    const p = { ...recipeProject, specs: [blockedDone, ...recipeProject.specs.slice(1)], archived: [blockedArchived] };
    expect(overviewCounts(p)).toEqual({ todo: 4, doing: 1, review: 1, done: 3, blocked: 2, total: 9 });
  });

  it('copes with a project without config or overview', () => {
    const p = { ...recipeProject, config: null, overview: null, specs: [], archived: [] };
    expect(exportOverview(p, 'Café & Co')).toEqual({
      filename: 'cafe-and-co-overview.md',
      text: '# Café & Co\n\n\n\n## Counts\n- To-do: 0\n- Doing: 0\n- Review: 0\n- Done: 0\n- Blocked: 0\n\n## Progress\n\n',
    });
  });
});
