import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadProject } from '../src/project.js';
import { renderTree } from '../src/tree.js';

const tmpDirs: string[] = [];
afterEach(async () => {
  for (const d of tmpDirs.splice(0)) await fs.rm(d, { recursive: true, force: true });
});

interface F { id: string; title: string; status?: string; draft?: boolean; milestone?: string; spec: string; subtasks: string[]; archive?: boolean }

async function fixture(config: string, specs: F[]): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'specboard-tree-'));
  tmpDirs.push(root);
  await fs.mkdir(path.join(root, '.specboard'), { recursive: true });
  await fs.writeFile(path.join(root, '.specboard', 'config.md'), config);
  for (const s of specs) {
    const dir = path.join(root, '.specboard', s.archive ? 'archive' : 'specs', `${s.id}-x`);
    await fs.mkdir(dir, { recursive: true });
    const fm = [`id: ${s.id}`, `title: ${s.title}`, `status: ${s.status ?? 'todo'}`, `draft: ${s.draft ?? false}`];
    if (s.milestone) fm.push(`milestone: ${s.milestone}`);
    await fs.writeFile(path.join(dir, 'spec.md'), `---\n${fm.join('\n')}\n---\n\n## Spec\n\n${s.spec}\n\n## Subtasks\n\n${s.subtasks.join('\n')}\n`);
  }
  return root;
}

const SPECS: F[] = [
  { id: 'T-100', title: 'Scaffold', status: 'done', archive: true, spec: 'Old.', subtasks: ['- [x] 1. a'] },
  { id: 'T-101', title: 'Recipe list page', status: 'done', milestone: 'Basics', spec: 'A grid of saved recipes with photo, cook time and tags.\nMore text.', subtasks: ['- [x] 1. Build the grid', '- [x] 2. Write tests'] },
  { id: 'T-104', title: 'Meal planner calendar', status: 'doing', milestone: 'Basics', spec: 'A weekly calendar where recipes can be dragged onto days. Saved per user.', subtasks: ['- [x] 1. Calendar layout', '- [ ] 2. Drag and drop'] },
  { id: 'T-107', title: 'Dark mode', draft: true, spec: 'Respect the system theme and add a manual toggle.', subtasks: ['- [ ] 1. (you) Pick the colours', '- [x] 2. (you) Sign off'] },
];

describe('renderTree', () => {
  it('draws a project without milestones', async () => {
    const root = await fixture('---\nname: Recipe Box\n---\n', SPECS.map((s) => ({ ...s, milestone: undefined })));
    expect(renderTree(await loadProject(root))).toBe(
      [
        'Recipe Box · 2/4 done',
        '├─ T-101 Recipe list page · done',
        '│    A grid of saved recipes with photo, cook time and tags.',
        '│    ├─ ✓ 1. Build the grid',
        '│    └─ ✓ 2. Write tests',
        '├─ T-104 Meal planner calendar · doing',
        '│    A weekly calendar where recipes can be dragged onto days.',
        '│    ├─ ✓ 1. Calendar layout',
        '│    └─ ○ 2. Drag and drop',
        '└─ T-107 Dark mode · todo (draft)',
        '     Respect the system theme and add a manual toggle.',
        '     ├─ ○ 1. you: Pick the colours',
        '     └─ ✓ 2. you: Sign off',
      ].join('\n'),
    );
  });

  it('draws milestones and the No milestone group', async () => {
    const root = await fixture('---\nname: Recipe Box\nmilestones: [Basics, Later]\n---\n', SPECS);
    const p = await loadProject(root);
    expect(renderTree(p, { subtasks: false })).toBe(
      [
        'Recipe Box · 2/4 done',
        '├─ Milestone: Basics · 1/2',
        '│  ├─ T-101 Recipe list page · done',
        '│  │    A grid of saved recipes with photo, cook time and tags.',
        '│  └─ T-104 Meal planner calendar · doing',
        '│       A weekly calendar where recipes can be dragged onto days.',
        '├─ Milestone: Later · 0/0',
        '└─ No milestone',
        '   └─ T-107 Dark mode · todo (draft)',
        '        Respect the system theme and add a manual toggle.',
      ].join('\n'),
    );
    expect(renderTree(p)).toContain('│  │    ├─ ✓ 1. Build the grid');
    expect(renderTree(p)).toContain('│       └─ ○ 2. Drag and drop');
  });

  it('prints one milestone', async () => {
    const root = await fixture('---\nname: Recipe Box\nmilestones: [Basics, Later]\n---\n', SPECS);
    const p = await loadProject(root);
    expect(renderTree(p, { milestone: 'Basics', subtasks: false })).toBe(
      [
        'Recipe Box · 2/4 done',
        '└─ Milestone: Basics · 1/2',
        '   ├─ T-101 Recipe list page · done',
        '   │    A grid of saved recipes with photo, cook time and tags.',
        '   └─ T-104 Meal planner calendar · doing',
        '        A weekly calendar where recipes can be dragged onto days.',
      ].join('\n'),
    );
    expect(() => renderTree(p, { milestone: 'Nope' })).toThrow('Unknown milestone: Nope');
  });

  it('prints only the requested spec', async () => {
    const root = await fixture('---\nname: Recipe Box\n---\n', SPECS);
    const p = await loadProject(root);
    expect(renderTree(p, { spec: 'T-104' })).toBe(
      [
        'T-104 Meal planner calendar · doing',
        '  A weekly calendar where recipes can be dragged onto days.',
        '  ├─ ✓ 1. Calendar layout',
        '  └─ ○ 2. Drag and drop',
      ].join('\n'),
    );
    expect(() => renderTree(p, { spec: 'T-999' })).toThrow('Unknown spec: T-999');
    expect(() => renderTree(p, { spec: 'T-100' })).toThrow('Unknown spec: T-100');
    expect(() => renderTree(p, { milestone: 'Basics' })).toThrow('Unknown milestone: Basics');
  });

  it('cuts long first sentences and omits empty Spec sections', async () => {
    const long = 'x'.repeat(80);
    const root = await fixture('---\nname: P\n---\n', [
      { id: 'T-001', title: 'Long', spec: `${long}. Next.`, subtasks: [] },
      { id: 'T-002', title: 'Empty', spec: '', subtasks: [] },
    ]);
    expect(renderTree(await loadProject(root))).toBe(
      ['P · 0/2 done', '├─ T-001 Long · todo', `│    ${'x'.repeat(69)}…`, '└─ T-002 Empty · todo'].join('\n'),
    );
  });
});

describe('renderTree counts with archived specs', () => {
  it('counts an archived spec only when done, in the first line and milestone counts', async () => {
    const root = await fixture('---\nname: P\nmilestones: [Basics]\n---\n', [
      { id: 'T-100', title: 'Old done', status: 'done', milestone: 'Basics', archive: true, spec: 'Old.', subtasks: [] },
      { id: 'T-101', title: 'Old todo', status: 'todo', milestone: 'Basics', archive: true, spec: 'Old.', subtasks: [] },
      { id: 'T-102', title: 'Live', status: 'todo', milestone: 'Basics', spec: 'Live.', subtasks: [] },
    ]);
    const out = renderTree(await loadProject(root), { subtasks: false });
    expect(out.split('\n')[0]).toBe('P · 1/2 done');
    expect(out).toContain('Milestone: Basics · 1/2');
  });
});
