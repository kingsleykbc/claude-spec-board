import { groupByMilestone, hasMilestones } from './milestones.js';
import type { Project, Spec } from './project.js';
import { youStep } from './you.js';

export interface TreeOptions { spec?: string; milestone?: string; subtasks?: boolean }

const MAX_LEN = 70;

/** First sentence of the Spec section (whitespace collapsed), cut to 70 characters with an ellipsis. */
function firstSentence(specMd: string): string {
  const text = specMd.replace(/\s+/g, ' ').trim();
  const m = /^.*?[.!?](?=\s|$)/.exec(text);
  const s = m ? m[0] : text;
  return s.length > MAX_LEN ? `${s.slice(0, MAX_LEN - 1)}…` : s;
}

const specLine = (s: Spec): string => `${s.id} ${s.title} · ${s.status}${s.draft ? ' (draft)' : ''}`;

/** Lines below a spec line: first sentence, then subtasks, all starting at `indent`. */
function details(s: Spec, indent: string, subtasks: boolean): string[] {
  const out: string[] = [];
  const sentence = firstSentence(s.specMd);
  if (sentence !== '') out.push(indent + sentence);
  if (subtasks) {
    s.subtasks.forEach((t, i) => {
      const you = youStep(t.title);
      const text = you === null ? t.title : `you: ${you}`;
      out.push(`${indent}${i === s.subtasks.length - 1 ? '└─' : '├─'} ${t.done ? '✓' : '○'} ${t.n}. ${text}`);
    });
  }
  return out;
}

function specBlock(specs: Spec[], prefix: string, subtasks: boolean): string[] {
  const out: string[] = [];
  specs.forEach((s, i) => {
    const last = i === specs.length - 1;
    out.push(`${prefix}${last ? '└─' : '├─'} ${specLine(s)}`);
    out.push(...details(s, `${prefix}${last ? ' ' : '│'}    `, subtasks));
  });
  return out;
}

const isDone = (s: Spec): boolean => s.status === 'done' || s.archived;

/** Text tree of a project: milestones (when it has them), specs, first sentence and subtasks. Throws on an unknown spec or milestone. */
export function renderTree(project: Project, opts: TreeOptions = {}): string {
  const subtasks = opts.subtasks ?? true;

  if (opts.spec !== undefined) {
    const s = project.specs.find((x) => x.id === opts.spec);
    if (!s) throw new Error(`Unknown spec: ${opts.spec}`);
    return [specLine(s), ...details(s, '  ', subtasks)].join('\n');
  }

  const all = [...project.specs, ...project.archived];
  const name = project.config?.name || project.root.split(/[\\/]/).filter(Boolean).pop() || 'Project';
  const lines = [`${name} · ${all.filter(isDone).length}/${all.length} done`];

  if (!hasMilestones(project.config)) {
    if (opts.milestone !== undefined) throw new Error(`Unknown milestone: ${opts.milestone}`);
    lines.push(...specBlock(project.specs, '', subtasks));
    return lines.join('\n');
  }

  const milestones = project.config!.milestones;
  let groups = groupByMilestone(project.specs, milestones);
  if (opts.milestone !== undefined) {
    if (!milestones.includes(opts.milestone)) throw new Error(`Unknown milestone: ${opts.milestone}`);
    groups = groups.filter((g) => g.name === opts.milestone);
  }
  groups.forEach((g, i) => {
    const last = i === groups.length - 1;
    const branch = last ? '└─' : '├─';
    lines.push(g.name === null ? `${branch} No milestone` : `${branch} Milestone: ${g.name} · ${g.specs.filter(isDone).length}/${g.specs.length}`);
    lines.push(...specBlock(g.specs, last ? '   ' : '│  ', subtasks));
  });
  return lines.join('\n');
}
