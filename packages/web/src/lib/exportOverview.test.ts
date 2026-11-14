import { describe, expect, it } from 'vitest';
import { recipeProject } from '../fixtures/recipeBox';
import { exportOverview, overviewCounts } from './exportOverview';

const sub = (n: number, done: boolean) => ({ ...recipeProject.specs[0]!.subtasks[0]!, n, title: `Step ${n}`, done });
const mk = (id: string, title: string, status: 'todo' | 'doing' | 'review' | 'done', milestone: string | null, done: number, total: number) => ({
  ...recipeProject.specs[0]!,
  id,
  title,
  status,
  milestone,
  blocked: false,
  subtasks: Array.from({ length: total }, (_, i) => sub(i + 1, i < done)),
});
const small = (specs: ReturnType<typeof mk>[], milestones: string[]) => ({
  ...recipeProject,
  config: { ...recipeProject.config!, milestones },
  overview: { ...recipeProject.overview!, summaryMd: 'All good.' },
  specs,
  archived: [],
});
const head = (counts: string) => `# Recipe Box\n\n${recipeProject.config!.description.trim()}\n\n## Counts\n${counts}\n\n## Summary\nAll good.\n`;
const table = (rows: string) => `| ID | Title | Status | Progress |\n| --- | --- | --- | --- |\n${rows}\n`;

describe('exportOverview', () => {
  it('names the file after the project and writes heading, description, counts, summary and tasks', () => {
    const { filename, text } = exportOverview(recipeProject);
    expect(filename).toBe('recipe-box-overview.md');
    expect(text.startsWith('# Recipe Box\n\n')).toBe(true);
    expect(text).toContain('- Done: 3');
    expect(text).toContain(
      '## Counts\n- To-do: 4\n- Doing: 1\n- Review: 1\n- Done: 3\n- Blocked: 2\n\n' + `## Summary\n${recipeProject.overview!.summaryMd}\n\n## Tasks\n| ID | Title | Status | Progress |`,
    );
    expect(text).not.toContain('## Progress');
  });

  it('writes one Tasks table without milestones: status order, escaped pipes, newlines flattened, active specs only', () => {
    const p = {
      ...small([mk('T-2', 'Plan | shop', 'todo', null, 0, 2), mk('T-1', 'Recipe list', 'done', null, 4, 4), mk('T-4', 'Review\nme', 'review', null, 2, 2), mk('T-3', 'Planner', 'doing', null, 1, 3)], []),
      archived: [{ ...recipeProject.archived[0]!, id: 'T-0', title: 'Old archived' }],
    };
    expect(exportOverview(p).text).toBe(
      head('- To-do: 1\n- Doing: 1\n- Review: 1\n- Done: 2\n- Blocked: 0') +
        '\n## Tasks\n' +
        table('| T-2 | Plan \\| shop | To-do | 0/2 |\n| T-3 | Planner | Doing | 1/3 |\n| T-4 | Review me | Review | 2/2 |\n| T-1 | Recipe list | Done | 4/4 |'),
    );
  });

  it('groups by milestone, skips listed milestones with no active spec, and heads leftovers No milestone', () => {
    const p = small([mk('T-1', 'A', 'done', 'Basics', 2, 2), mk('T-2', 'B', 'todo', 'Planner', 0, 1), mk('T-3', 'C', 'doing', null, 0, 0)], ['Basics', 'Empty', 'Planner']);
    expect(exportOverview(p).text).toBe(
      head('- To-do: 1\n- Doing: 1\n- Review: 0\n- Done: 1\n- Blocked: 0') +
        '\n## Tasks\n### Basics\n' +
        table('| T-1 | A | Done | 2/2 |') +
        '\n### Planner\n' +
        table('| T-2 | B | To-do | 0/1 |') +
        '\n### No milestone\n' +
        table('| T-3 | C | Doing | 0/0 |'),
    );
  });

  it('counts archived as done, and blocked only for active, non-done specs', () => {
    const blockedDone = { ...recipeProject.specs[0]!, blocked: true };
    const blockedArchived = { ...recipeProject.archived[0]!, blocked: true };
    const p = { ...recipeProject, specs: [blockedDone, ...recipeProject.specs.slice(1)], archived: [blockedArchived] };
    expect(overviewCounts(p)).toEqual({ todo: 4, doing: 1, review: 1, done: 3, blocked: 2, total: 9 });
  });

  it('copes with a project without config or overview, and leaves out Tasks when there are no active specs', () => {
    const p = { ...recipeProject, config: null, overview: null, specs: [], archived: [] };
    expect(exportOverview(p, 'Café & Co')).toEqual({
      filename: 'cafe-and-co-overview.md',
      text: '# Café & Co\n\n\n\n## Counts\n- To-do: 0\n- Doing: 0\n- Review: 0\n- Done: 0\n- Blocked: 0\n\n## Summary\n\n',
    });
  });
});

describe('exportOverview tokens', () => {
  const withTokens = (trackTokens: boolean, tokens: number | null) => {
    const sp = recipeProject.specs[0]!;
    const log = { subtask: 1, commit: null, files: [], pr: null, doneAt: null, tokens, obsolete: null, entries: [], problems: [] };
    return { ...recipeProject, settings: { trackTokens, problems: [] }, specs: [{ ...sp, logs: { 1: log } }, ...recipeProject.specs.slice(1)] };
  };
  it('ends Counts with "- Tokens used" when tracking is on and the total is above 0', () => {
    expect(exportOverview(withTokens(true, 48200)).text).toContain('- Blocked: 2\n- Tokens used: 48.2k\n\n## Summary');
  });
  it('leaves it out when tracking is off or the total is 0', () => {
    expect(exportOverview(withTokens(false, 48200)).text).not.toContain('Tokens used');
    expect(exportOverview(withTokens(true, null)).text).not.toContain('Tokens used');
  });
});
