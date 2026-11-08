import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { archiveSpec, createSpec, initProject, nextId, unarchiveSpec, writeIfUnchanged } from '../src/write.js';
import { slugify } from '../src/slug.js';
import { setMetaField, setSubtaskDone } from '../src/edit.js';
import { findSections } from '../src/sections.js';
import { hashText, loadProject } from '../src/project.js';
import { parseSpec } from '../src/parseSpec.js';
import * as api from '../src/index.js';

const SAMPLE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../examples/recipe-box');
const tmpDirs: string[] = [];
afterEach(async () => {
  for (const d of tmpDirs.splice(0)) await fs.rm(d, { recursive: true, force: true });
});
async function tmp(): Promise<string> {
  const d = await fs.mkdtemp(path.join(os.tmpdir(), 'specboard-w-'));
  tmpDirs.push(d);
  return d;
}
async function sampleCopy(): Promise<string> {
  const d = await tmp();
  await fs.cp(SAMPLE, d, { recursive: true });
  return d;
}
const today = (): string => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
};

describe('writeIfUnchanged', () => {
  it('returns a conflict and leaves the file alone when it changed on disk', async () => {
    const root = await sampleCopy();
    const spec = (await loadProject(root)).specs[0]!;
    const oldHash = spec.hash;
    await fs.appendFile(spec.path, '\nchanged by someone else\n');
    const disk = await fs.readFile(spec.path, 'utf8');
    const r = await writeIfUnchanged(spec.path, oldHash, (t) => setSubtaskDone(t, 1, true));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.conflict).toBe(true);
      expect(r.currentText).toBe(disk);
      expect(r.currentHash).toBe(hashText(disk));
    }
    expect(await fs.readFile(spec.path, 'utf8')).toBe(disk);
  });

  it('writes when the hash matches and returns the new hash', async () => {
    const root = await sampleCopy();
    const spec = (await loadProject(root)).specs[0]!;
    const before = await fs.readFile(spec.path, 'utf8');
    const r = await writeIfUnchanged(spec.path, spec.hash, (t) => t + '\nextra\n');
    expect(r.ok).toBe(true);
    const disk = await fs.readFile(spec.path, 'utf8');
    expect(disk).toBe(before + '\nextra\n');
    if (r.ok) {
      expect(r.hash).toBe(hashText(disk));
      expect(r.text).toBe(disk);
    }
  });

  it('leaves no tmp files behind', async () => {
    const root = await sampleCopy();
    const spec = (await loadProject(root)).specs[0]!;
    await writeIfUnchanged(spec.path, spec.hash, (t) => t + '\nx\n');
    expect((await fs.readdir(spec.dir)).filter((n) => n.endsWith('.tmp'))).toEqual([]);
  });
});

describe('slugify', () => {
  it('handles symbols and non-ASCII', () => {
    expect(slugify('Search & filters')).toBe('search-filters');
    expect(slugify('Café menu')).toBe('cafe-menu');
    expect(slugify('A/B test: "v2"?')).toBe('a-b-test-v2');
    expect(slugify('!!!')).toBe('spec');
  });
  it('caps at 40 chars with no trailing dash', () => {
    const s = slugify('word '.repeat(20));
    expect(s.length).toBeLessThanOrEqual(40);
    expect(s.endsWith('-')).toBe(false);
    expect(s).toMatch(/^[a-z0-9-]+$/);
  });
});

describe('nextId', () => {
  it('counts active and archived specs', async () => {
    const root = await sampleCopy();
    expect(await nextId(root)).toBe('T-109');
    await fs.mkdir(path.join(root, '.specboard', 'archive', 'T-110-old'), { recursive: true });
    expect(await nextId(root)).toBe('T-111');
  });
  it('starts at T-001 in an empty project', async () => {
    const root = await tmp();
    await initProject(root, 'p');
    expect(await nextId(root)).toBe('T-001');
  });
  it('compares numerically', async () => {
    const root = await tmp();
    await initProject(root, 'p');
    await fs.mkdir(path.join(root, '.specboard', 'specs', 'T-999-a'));
    await fs.mkdir(path.join(root, '.specboard', 'specs', 'T-1000-b'));
    expect(await nextId(root)).toBe('T-1001');
  });
});

describe('createSpec', () => {
  it('writes a well-formed spec', async () => {
    const root = await tmp();
    await initProject(root, 'p');
    const s = await createSpec(root, { title: 'Booking page', description: 'Let people book.', draft: true });
    expect(s.id).toBe('T-001');
    const file = path.join(root, '.specboard', 'specs', 'T-001-booking-page', 'spec.md');
    const text = await fs.readFile(file, 'utf8');
    expect(text).not.toContain('\r');
    const doc = parseSpec(text);
    expect(doc.problems).toEqual([]);
    expect(doc.status).toBe('todo');
    expect(doc.draft).toBe(true);
    expect(doc.urgency).toBe('normal');
    expect(doc.created).toBe(today());
    expect(doc.updated).toBe(today());
    expect(doc.specMd.trim()).toBe('Let people book.');
    expect(doc.featuresMd.trim()).toBe('');
    expect(doc.questions).toEqual([]);
    expect(doc.subtasks).toEqual([]);
    for (const h of ['## Spec', '## Features', '## Open questions', '## Subtasks']) expect(text).toContain(h + '\n');
    expect(s.path).toBe(file);
  });

  it('honours urgency and categories, and survives odd titles', async () => {
    const root = await tmp();
    await initProject(root, 'p');
    const s = await createSpec(root, { title: 'A/B: "x"', description: 'd', draft: false, urgency: 'high', categories: ['ui', 'api'] });
    expect(s.title).toBe('A/B: "x"');
    expect(s.urgency).toBe('high');
    expect(s.categories).toEqual(['ui', 'api']);
    expect(s.draft).toBe(false);
  });
});

describe('archive / unarchive', () => {
  it('moves done specs to archive and back', async () => {
    const root = await sampleCopy();
    expect((await loadProject(root)).specs.find((s) => s.id === 'T-101')!.status).toBe('done');
    await archiveSpec(root, 'T-101');
    const p1 = await loadProject(root);
    expect(p1.specs.find((s) => s.id === 'T-101')).toBeUndefined();
    expect(p1.archived.find((s) => s.id === 'T-101')).toBeDefined();
    await unarchiveSpec(root, 'T-101');
    const p2 = await loadProject(root);
    expect(p2.specs.find((s) => s.id === 'T-101')).toBeDefined();
  });

  it('rejects non-done specs and unknown ids', async () => {
    const root = await tmp();
    await initProject(root, 'p');
    const s = await createSpec(root, { title: 'x', description: '', draft: false });
    await expect(archiveSpec(root, s.id)).rejects.toThrow('Only done specs can be archived');
    await expect(archiveSpec(root, 'T-999')).rejects.toThrow('Spec T-999 not found');
    await expect(unarchiveSpec(root, 'T-999')).rejects.toThrow('Spec T-999 not found');
    expect((await loadProject(root)).specs).toHaveLength(1);
  });
});

describe('initProject', () => {
  it('creates the layout and is a no-op the second time', async () => {
    const root = await tmp();
    await initProject(root, 'Recipes');
    const sb = path.join(root, '.specboard');
    const p = await loadProject(root);
    expect(p.config?.name).toBe('Recipes');
    expect(p.config?.references).toEqual([]);
    expect(p.overview?.updated).toBeNull();
    expect((await fs.stat(path.join(sb, 'specs'))).isDirectory()).toBe(true);
    expect((await fs.stat(path.join(sb, 'archive'))).isDirectory()).toBe(true);
    const before = await fs.readFile(path.join(sb, 'config.md'));
    await initProject(root, 'Other');
    expect((await fs.readFile(path.join(sb, 'config.md'))).equals(before)).toBe(true);
  });
});

describe('index', () => {
  it('re-exports the public API', () => {
    for (const k of ['loadProject', 'parseSpec', 'setMetaField', 'writeIfUnchanged', 'slugify', 'hashText', 'splitFrontMatter', 'parseConfig', 'findSections', 'deriveState']) {
      expect(typeof (api as Record<string, unknown>)[k]).toBe('function');
    }
  });
});

describe('final fixes: concurrency', () => {
  it('F1: overlapping writes with the same base hash give one ok and one conflict', async () => {
    const root = await sampleCopy();
    const spec = (await loadProject(root)).specs[0]!;
    const [a, b] = await Promise.all([
      writeIfUnchanged(spec.path, spec.hash, (t) => setMetaField(t, 'status', 'review')),
      writeIfUnchanged(spec.path, spec.hash, (t) => setMetaField(t, 'urgency', 'urgent')),
    ]);
    const results = [a, b];
    const oks = results.filter((r) => r.ok);
    const conflicts = results.filter((r) => !r.ok);
    expect(oks).toHaveLength(1);
    expect(conflicts).toHaveLength(1);
    const ok = oks[0]!;
    if (ok.ok) expect(await fs.readFile(spec.path, 'utf8')).toBe(ok.text);
    const c = conflicts[0]!;
    if (!c.ok) expect(c.conflict).toBe(true);
  });

  it('F6: concurrent createSpec calls get distinct IDs and folders', async () => {
    const root = await tmp();
    await initProject(root, 'p');
    const specs = await Promise.all([
      createSpec(root, { title: 'One', description: '', draft: false }),
      createSpec(root, { title: 'Two', description: '', draft: false }),
      createSpec(root, { title: 'Three', description: '', draft: false }),
    ]);
    expect(new Set(specs.map((s) => s.id)).size).toBe(3);
    const folders = await fs.readdir(path.join(root, '.specboard', 'specs'));
    expect(folders).toHaveLength(3);
    const p = await loadProject(root);
    expect(p.specs.map((s) => s.id).sort()).toEqual(['T-001', 'T-002', 'T-003']);
  });

  it('F5: a createSpec description with ## headings adds no sections', async () => {
    const root = await tmp();
    await initProject(root, 'p');
    const s = await createSpec(root, { title: 'x', description: 'intro\n## Features\n- [ ] 1. fake', draft: false });
    const text = await fs.readFile(s.path, 'utf8');
    const lines = text.split('\n');
    expect([...findSections(lines).keys()]).toEqual(['spec', 'features', 'open questions', 'subtasks']);
    expect(s.featuresMd).toBe('');
    expect(s.specMd).toContain('### Features');
  });
});
