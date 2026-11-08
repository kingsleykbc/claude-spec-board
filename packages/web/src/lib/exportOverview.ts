import type { Project } from '@specboard/core';

// The Overview's numbers and its Markdown export (pinned behaviour 17, Ruling 4).

export interface OverviewCounts {
  todo: number;
  doing: number;
  review: number;
  /** Active specs in Done plus every archived spec. */
  done: number;
  /** Active, non-done specs that are blocked. */
  blocked: number;
  /** Active plus archived. */
  total: number;
}

export function overviewCounts(project: Pick<Project, 'specs' | 'archived'>): OverviewCounts {
  const live = project.specs;
  const n = (k: string) => live.filter((s) => s.status === k).length;
  return {
    todo: n('todo'),
    doing: n('doing'),
    review: n('review'),
    done: n('done') + project.archived.length,
    blocked: live.filter((s) => s.status !== 'done' && s.blocked).length,
    total: live.length + project.archived.length,
  };
}

/** The prototype's `slug` (line 506), with accents folded to ASCII first. */
export function slug(name: string): string {
  const s = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return s || 'project';
}

/** `<slug(name)>-overview.md` with a heading, the description, the counts list and the summary. */
export function exportOverview(project: Project, name: string = project.config?.name || 'Project'): { filename: string; text: string } {
  const c = overviewCounts(project);
  const description = project.config?.description.trim() ?? '';
  const summary = project.overview?.summaryMd.trim() ?? '';
  const text =
    `# ${name}\n\n${description}\n\n` +
    `## Counts\n- To-do: ${c.todo}\n- Doing: ${c.doing}\n- Review: ${c.review}\n- Done: ${c.done}\n- Blocked: ${c.blocked}\n\n` +
    `## Progress\n${summary}\n`;
  return { filename: `${slug(name)}-overview.md`, text };
}
