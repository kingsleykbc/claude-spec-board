import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseSpecMeta } from '../src/frontmatter.js';
import { parseConfig, parseLog } from '../src/parseOther.js';
import { loadProject } from '../src/project.js';
import { setMetaField } from '../src/edit.js';
import { currentMilestone, groupByMilestone, hasMilestones, milestoneOf } from '../src/milestones.js';

const tmpDirs: string[] = [];
afterEach(async () => {
  for (const d of tmpDirs.splice(0)) await fs.rm(d, { recursive: true, force: true });
});

async function project(config: string, specFront: string): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'specboard-ms-'));
  tmpDirs.push(root);
  const dir = path.join(root, '.specboard', 'specs', 'T-001-x');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(root, '.specboard', 'config.md'), config);
  await fs.writeFile(path.join(dir, 'spec.md'), `---\nid: T-001\ntitle: X\n${specFront}---\n\n## Spec\n\nx\n\n## Subtasks\n\n- [ ] 1. one\n`);
  return root;
}

describe('parsing', () => {
  it('reads and trims milestone', () => {
    expect(parseSpecMeta('id: A\nmilestone: Basics').meta.milestone).toBe('Basics');
    expect(parseSpecMeta('id: A\nmilestone: "  "').meta.milestone).toBeNull();
    expect(parseSpecMeta('id: A').meta.milestone).toBeNull();
  });
  it('reads config milestones and closing_steps', () => {
    const c = parseConfig('---\nname: P\nmilestones: [Basics, " Sharing ", "", Basics]\nclosing_steps: [Write tests]\n---\n');
    expect(c.milestones).toEqual(['Basics', 'Sharing']);
    expect(c.closingSteps).toEqual(['Write tests']);
    const none = parseConfig('---\nname: P\n---\n');
    expect(none.milestones).toEqual([]);
    expect(none.closingSteps).toEqual([]);
  });
  it('reads pr from a log', () => {
    expect(parseLog('---\nsubtask: 1\npr: https://github.com/o/r/pull/7\n---\n').pr).toBe('https://github.com/o/r/pull/7');
    expect(parseLog('---\nsubtask: 1\n---\n').pr).toBeNull();
  });
  it('keeps the milestone line when another field is set', () => {
    const text = '---\nid: A\ntitle: T\nstatus: todo\nmilestone: Basics\n---\n\nbody\n';
    const out = setMetaField(text, 'status', 'doing');
    expect(out).toContain('milestone: Basics\n');
    expect(out).toContain('status: doing');
  });
});

describe('helpers', () => {
  const specs = [
    { id: 1, milestone: 'Sharing', status: 'todo' },
    { id: 2, milestone: 'Basics', status: 'done' },
    { id: 3, milestone: null, status: 'todo' },
    { id: 4, milestone: 'nope', status: 'todo' },
  ];
  it('hasMilestones / milestoneOf', () => {
    expect(hasMilestones(null)).toBe(false);
    expect(hasMilestones({ milestones: [] })).toBe(false);
    expect(hasMilestones({ milestones: ['A'] })).toBe(true);
    expect(milestoneOf({ milestone: ' Basics ' }, ['Basics'])).toBe('Basics');
    expect(milestoneOf({ milestone: 'basics' }, ['Basics'])).toBeNull();
  });
  it('groups in list order, empty kept, No milestone last', () => {
    const g = groupByMilestone(specs, ['Basics', 'Empty', 'Sharing']);
    expect(g.map((x) => x.name)).toEqual(['Basics', 'Empty', 'Sharing', null]);
    expect(g[0]!.specs.map((s) => s.id)).toEqual([2]);
    expect(g[1]!.specs).toEqual([]);
    expect(g[3]!.specs.map((s) => s.id)).toEqual([3, 4]);
  });
  it('omits No milestone when empty', () => {
    expect(groupByMilestone([specs[1]!], ['Basics']).map((x) => x.name)).toEqual(['Basics']);
  });
  it('currentMilestone', () => {
    expect(currentMilestone(specs, ['Basics', 'Sharing'])).toBe('Sharing');
    expect(currentMilestone([{ milestone: 'Basics', status: 'done' }, { milestone: 'Sharing', status: 'done' }], ['Basics', 'Sharing'])).toBe('Sharing');
    expect(currentMilestone(specs, [])).toBeNull();
  });
});

describe('unknown milestone problem', () => {
  it('flags a milestone not in the list', async () => {
    const root = await project('---\nname: P\nmilestones: [Basics]\n---\n', 'milestone: basics\n');
    const p = await loadProject(root);
    expect(p.specs[0]!.problems).toContain('Unknown milestone "basics"');
    expect(milestoneOf(p.specs[0]!, p.config!.milestones)).toBeNull();
  });
  it('does not flag when no milestones are configured', async () => {
    const root = await project('---\nname: P\n---\n', 'milestone: X\n');
    const p = await loadProject(root);
    expect(p.specs[0]!.problems.filter((x) => x.includes('milestone'))).toEqual([]);
  });
});
