import type { Project, Spec } from '@specboard/core';
import { groupByMilestone, projectProgress } from '@specboard/core/milestones';
import { projectTokens } from '../state/allLogs';
import { orderSpecs } from '../state/filters';
import { formatTokens } from './formatTokens';
import { isBlocked, ST } from './vm';

// The Overview's numbers and its Markdown export (pinned behaviour 17, Ruling 4).

export interface OverviewCounts {
  todo: number;
  doing: number;
  review: number;
  /** Done specs, active or archived (an archived spec that isn't done leaves the count). */
  done: number;
  /** Active, non-done specs that are blocked. */
  blocked: number;
  /** Active specs plus archived done ones. */
  total: number;
}

export function overviewCounts(project: Pick<Project, 'specs' | 'archived'>): OverviewCounts {
  const live = project.specs;
  const n = (k: string) => live.filter((s) => s.status === k).length;
  const progress = projectProgress(live, project.archived);
  return {
    todo: n('todo'),
    doing: n('doing'),
    review: n('review'),
    done: progress.done,
    blocked: live.filter(isBlocked).length,
    total: progress.total,
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

function table(specs: Spec[]): string {
  const cell = (x: string) => x.replace(/\r?\n/g, ' ').replace(/\|/g, '\\|');
  const rows = orderSpecs(specs).map((x) => `| ${x.id} | ${cell(x.title)} | ${ST[x.status].label} | ${x.subtasks.filter((t) => t.done).length}/${x.subtasks.length} |`);
  return ['| ID | Title | Status | Progress |', '| --- | --- | --- | --- |', ...rows].join('\n') + '\n';
}

/** The "## Tasks" section: active specs only; one table per milestone that has a spec, or one table without milestones. Empty when no active specs. */
function tasksSection(project: Project): string {
  if (project.specs.length === 0) return '';
  const milestones = project.config?.milestones ?? [];
  if (milestones.length === 0) return `\n## Tasks\n${table(project.specs)}`;
  const groups = groupByMilestone(project.specs, milestones)
    .filter((g) => g.specs.length > 0)
    .map((g) => `### ${g.name ?? 'No milestone'}\n${table(g.specs)}`);
  return `\n## Tasks\n${groups.join('\n')}`;
}

/** `<slug(name)>-overview.md` with a heading, the description, the counts list, the summary and the tasks tables. */
export function exportOverview(project: Project, name: string = project.config?.name || 'Project'): { filename: string; text: string } {
  const c = overviewCounts(project);
  const description = project.config?.description.trim() ?? '';
  const summary = project.overview?.summaryMd.trim() ?? '';
  const tokens = project.settings.trackTokens ? projectTokens(project) : 0;
  const text =
    `# ${name}\n\n${description}\n\n` +
    `## Counts\n- To-do: ${c.todo}\n- Doing: ${c.doing}\n- Review: ${c.review}\n- Done: ${c.done}\n- Blocked: ${c.blocked}\n${tokens > 0 ? `- Tokens used: ${formatTokens(tokens)}\n` : ''}\n` +
    `## Summary\n${summary}\n` +
    tasksSection(project);
  return { filename: `${slug(name)}-overview.md`, text };
}
