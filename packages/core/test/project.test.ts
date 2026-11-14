import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveState, hashText, loadProject, type Project } from '../src/project.js';
import { parseSpec } from '../src/parseSpec.js';
import { specBodyMd } from '../src/edit.js';

const SAMPLE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../examples/recipe-box');

const tmpDirs: string[] = [];
afterEach(async () => {
  for (const d of tmpDirs.splice(0)) await fs.rm(d, { recursive: true, force: true });
});

function specText(id: string, opts: { deps?: string[]; status?: string; questions?: string } = {}): string {
  const deps = opts.deps?.length ? '\n' + opts.deps.map((d) => `  - ${d}`).join('\n') : ' []';
  return `---\nid: ${id}\ntitle: Spec ${id}\nstatus: ${opts.status ?? 'todo'}\ndepends_on:${deps}\n---\n\n## Spec\n\nx\n\n## Open questions\n\n${opts.questions ?? ''}\n\n## Subtasks\n\n- [ ] 1. one\n`;
}

async function makeProject(files: Record<string, string>): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'specboard-'));
  tmpDirs.push(root);
  for (const [rel, text] of Object.entries(files)) {
    const p = path.join(root, '.specboard', ...rel.split('/'));
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, text);
  }
  return root;
}

describe('hashText', () => {
  it('is sha256 hex', () => {
    expect(hashText('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('sample project', () => {
  let p: Project;
  beforeAll(async () => {
    p = await loadProject(SAMPLE);
  });
  const get = (id: string) => p.specs.find((s) => s.id === id)!;

  it('loads sample', () => {
    expect(p.problems).toEqual([]);
    expect(p.config?.name).toBe('Recipe Box');
    expect(p.config?.references).toHaveLength(5);
    expect(p.overview?.summaryMd).toContain('Recipe Box');
    expect(p.specs).toHaveLength(8);
    expect(p.specs.map((s) => s.id)).toEqual(['T-101', 'T-102', 'T-103', 'T-104', 'T-105', 'T-106', 'T-107', 'T-108']);
    expect(p.archived.map((s) => s.id)).toEqual(['T-100']);
    expect(p.archived[0]!.archived).toBe(true);
    const t104 = get('T-104');
    expect(t104.currentSubtask).toBe(3);
    expect(t104.progress).toEqual({ done: 2, total: 5 });
    expect(t104.subtasks[0]!.hasLog).toBe(true);
    expect(t104.subtasks[1]!.hasLog).toBe(true);
    expect(t104.subtasks[2]!.hasLog).toBe(false);
    expect(t104.logs[1]!.commit).toBe('4f2a91c');
    expect(t104.slug).toBe('meal-planner-calendar');
    expect(t104.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(t104.archived).toBe(false);
    expect(path.basename(t104.dir)).toBe('T-104-meal-planner-calendar');
    expect(path.basename(t104.path)).toBe('spec.md');
    expect(get('T-107').draft).toBe(true);
  });

  it('bodyHash is hashText(specBodyMd(text)) and ignores front matter and question/subtask edits', async () => {
    const t104 = get('T-104');
    const text = await fs.readFile(t104.path, 'utf8');
    expect(t104.bodyHash).toBe(hashText(specBodyMd(text)));
    expect(t104.bodyHash).not.toBe(t104.hash);
    const root = await makeProject({ 'specs/T-001-a/spec.md': specText('T-001') });
    const before = (await loadProject(root)).specs[0]!;
    const file = before.path;
    await fs.writeFile(file, specText('T-001', { status: 'doing', questions: '1. Why?' }));
    const after = (await loadProject(root)).specs[0]!;
    expect(after.hash).not.toBe(before.hash);
    expect(after.bodyHash).toBe(before.bodyHash);
    await fs.writeFile(file, specText('T-001').replace('\nx\n', '\ny\n'));
    expect((await loadProject(root)).specs[0]!.bodyHash).not.toBe(before.bodyHash);
  });

  it('blocked by questions', () => {
    const t = get('T-105');
    expect(t.blocked).toBe(true);
    expect(t.blockedReasons).toContain('2 open questions') // Q2 is optional;
  });

  it('blocked by dependency', () => {
    const t = get('T-108');
    expect(t.blocked).toBe(true);
    expect(t.blockedReasons).toContain('Waiting on T-106 (todo)');
  });

  it('dependents', () => {
    expect(get('T-106').dependents).toEqual(['T-108']);
    expect(get('T-104').dependents).toEqual(['T-105']);
  });
});

describe('deriveState', () => {
  const doc = (id: string, deps: string[] = [], status = 'todo', q = '') =>
    parseSpec(specText(id, { deps, status, questions: q }));

  it('handles missing, self, cyclic and archived dependencies', () => {
    const state = deriveState(
      [doc('T-001', ['T-999']), doc('T-002', ['T-002']), doc('T-003', ['T-004']), doc('T-004', ['T-003']), doc('T-005', ['T-100'])],
      [doc('T-100', [], 'done')],
    );
    expect(state.get('T-001')!.blockedReasons).toEqual(['T-999 not found']);
    expect(state.get('T-002')!.blockedReasons).toEqual(['Depends on itself']);
    expect(state.get('T-003')!.blocked).toBe(true);
    expect(state.get('T-004')!.blocked).toBe(true);
    expect(state.get('T-005')!.blocked).toBe(false);
    expect(state.get('T-100')!.dependents).toEqual(['T-005']);
  });

  it('uses singular for one question and ignores answered ones', () => {
    const q = '- [ ] Q1 (yesno): a?\n  > answer:\n- [x] Q2 (yesno): b?\n  > answer: yes';
    expect(deriveState([doc('T-001', [], 'todo', q)], []).get('T-001')!.blockedReasons).toEqual(['1 open question']);
  });

  it('does not block on a done dependency', () => {
    const s = deriveState([doc('T-001', ['T-002']), doc('T-002', [], 'done')], []);
    expect(s.get('T-001')!.blocked).toBe(false);
  });

  it('sorts dependents by ID', () => {
    const s = deriveState([doc('T-009', ['T-001']), doc('T-003', ['T-001']), doc('T-001')], []);
    expect(s.get('T-001')!.dependents).toEqual(['T-003', 'T-009']);
  });
});

describe('loadProject edge cases', () => {
  it('detects dependency problems end to end', async () => {
    const root = await makeProject({
      'config.md': '---\nname: X\n---\n',
      'specs/T-001-a/spec.md': specText('T-001', { deps: ['T-999'] }),
      'specs/T-002-b/spec.md': specText('T-002', { deps: ['T-002'] }),
      'specs/T-003-c/spec.md': specText('T-003', { deps: ['T-004'] }),
      'specs/T-004-d/spec.md': specText('T-004', { deps: ['T-003'] }),
      'specs/T-005-e/spec.md': specText('T-005', { deps: ['T-100'] }),
      'archive/T-100-old/spec.md': specText('T-100', { status: 'done' }),
    });
    const p = await loadProject(root);
    const by = (id: string) => p.specs.find((s) => s.id === id)!;
    expect(by('T-001').blockedReasons).toEqual(['T-999 not found']);
    expect(by('T-002').blockedReasons).toEqual(['Depends on itself']);
    expect(by('T-003').blocked && by('T-004').blocked).toBe(true);
    expect(by('T-005').blocked).toBe(false);
  });

  it('survives broken YAML and a missing spec.md', async () => {
    const root = await makeProject({
      'specs/T-001-ok/spec.md': specText('T-001'),
      'specs/T-002-bad/spec.md': '---\nid: T-002\ntitle: [unclosed\n---\n\n## Subtasks\n\n- [ ] 1. x\n',
      'specs/T-009-x/notes.txt': 'nothing',
    });
    const p = await loadProject(root);
    expect(p.specs.map((s) => s.id)).toContain('T-001');
    const bad = p.specs.find((s) => s.path.includes('T-002-bad'))!;
    expect(bad.problems.length).toBeGreaterThan(0);
    expect(p.problems).toContain('specs/T-009-x: missing spec.md');
  });

  it('returns a stub for a folder without .specboard', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'specboard-'));
    tmpDirs.push(root);
    const p = await loadProject(root);
    expect(p).toEqual({ root, config: null, overview: null, settings: { trackTokens: true, problems: [] }, specs: [], archived: [], problems: ['No .specboard folder'] });
  });

  it('files logs by the leading integer of the filename', async () => {
    const root = await makeProject({
      'specs/T-001-a/spec.md': specText('T-001'),
      'specs/T-001-a/logs/1-one.md': '---\nsubtask: 1\ncommit: abc\nfiles: []\n---\n\n### 2026-11-07 10:00\n\nhi\n',
      'specs/T-001-a/logs/readme.md': 'ignored',
    });
    const p = await loadProject(root);
    const s = p.specs[0]!;
    expect(Object.keys(s.logs)).toEqual(['1']);
    expect(s.subtasks[0]!.hasLog).toBe(true);
  });
});

describe('F6: duplicate and missing ids', () => {
  it('flags every spec that shares an ID', async () => {
    const root = await makeProject({
      'specs/T-001-a/spec.md': specText('T-001'),
      'specs/T-001-b/spec.md': specText('T-001'),
      'specs/T-002-c/spec.md': specText('T-002'),
    });
    const p = await loadProject(root);
    const dups = p.specs.filter((s) => s.problems.includes('Duplicate id T-001'));
    expect(dups.map((s) => path.basename(s.dir)).sort()).toEqual(['T-001-a', 'T-001-b']);
    expect(p.specs.find((s) => s.id === 'T-002')!.problems).toEqual([]);
  });
  it('records a problem for a spec folder with no id', async () => {
    const root = await makeProject({ 'specs/misc/spec.md': '---\ntitle: x\n---\n' });
    const p = await loadProject(root);
    expect(p.problems).toContain('Spec folder misc has no id');
  });
});
