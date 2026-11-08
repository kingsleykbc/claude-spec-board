import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { compareIds, loadProject } from '../src/project.js';
import { replaceSpecBody, specBodyMd } from '../src/edit.js';
import { setConfigReferences } from '../src/config.js';
import { parseSpec } from '../src/parseSpec.js';
import { writeSiblingDraft } from '../src/write.js';

const sample = path.resolve(import.meta.dirname, '../../../examples/recipe-box');
const t104Path = path.join(sample, '.specboard/specs/T-104-meal-planner-calendar/spec.md');
const configPath = path.join(sample, '.specboard/config.md');
const t104Lf = (await fs.readFile(t104Path, 'utf8')).replace(/\r\n/g, '\n');
const t104Crlf = t104Lf.replace(/\n/g, '\r\n');
const configText = (await fs.readFile(configPath, 'utf8')).replace(/\r\n/g, '\n');

const tmps: string[] = [];
async function tmp(): Promise<string> {
  const d = await fs.mkdtemp(path.join(os.tmpdir(), 'sb-m2-'));
  tmps.push(d);
  return d;
}
afterEach(async () => {
  vi.restoreAllMocks();
  for (const d of tmps.splice(0)) await fs.rm(d, { recursive: true, force: true });
});

const fromKept = (t: string): string => t.slice(t.indexOf('## Open questions'));
/** Open questions + Subtasks blocks (up to Notes, if any). */
const keptBlocks = (t: string): string => {
  const oq = t.indexOf('## Open questions');
  const notes = t.indexOf('## Notes', oq);
  return t.slice(oq, notes === -1 ? undefined : notes);
};

describe('specBodyMd', () => {
  it('starts with the Spec paragraph and omits Open questions and Subtasks', () => {
    const md = specBodyMd(t104Lf);
    expect(md.startsWith('A weekly calendar')).toBe(true);
    expect(md).toContain('## Features');
    expect(md).toContain('## Notes');
    expect(md).not.toContain('Open questions');
    expect(md).not.toContain('Subtasks');
    expect(md).not.toContain('## Spec');
    expect(md).not.toContain('id: T-104');
  });
});

describe.each([
  ['LF', t104Lf],
  ['CRLF', t104Crlf],
])('replaceSpecBody on %s', (_n, t) => {
  const eol = t.includes('\r\n') ? '\r\n' : '\n';
  it('round-trips byte-for-byte', () => {
    expect(replaceSpecBody(t, specBodyMd(t))).toBe(t);
  });
  it('round-trips with an LF body on a CRLF file', () => {
    expect(replaceSpecBody(t, specBodyMd(t).replace(/\r\n/g, '\n'))).toBe(t);
  });
  it('replaces the body and keeps Open questions and Subtasks untouched', () => {
    const out = replaceSpecBody(t, 'New intro\n\n## Features\n- a');
    expect(parseSpec(out).featuresMd).toBe('- a');
    expect(parseSpec(out).specMd).toBe('New intro');
    expect(keptBlocks(out)).toBe(keptBlocks(t));
    expect(out.slice(0, out.indexOf('## Spec'))).toBe(t.slice(0, t.indexOf('## Spec')));
    expect(parseSpec(out).subtasks.map((s) => s.title)).toEqual(parseSpec(t).subtasks.map((s) => s.title));
    if (eol === '\r\n') expect(/(?<!\r)\n/.test(out)).toBe(false);
  });
  it('keeps Notes after the kept blocks when the new body still has Notes', () => {
    const out = replaceSpecBody(t, `Intro\n\n## Notes\nn2`);
    expect(out.indexOf('## Notes')).toBeGreaterThan(out.indexOf('## Subtasks'));
    expect(out.endsWith(`n2${eol}`)).toBe(true);
  });
  it('demotes Open questions and Subtasks headings inside the new body', () => {
    const out = replaceSpecBody(t, 'x\n\n## Subtasks\n- [ ] 1. x\n\n## Open questions\n- [ ] Q9 (text): Z?');
    expect(parseSpec(out).subtasks.map((s) => s.title)).toEqual(parseSpec(t).subtasks.map((s) => s.title));
    expect(parseSpec(out).questions).toEqual(parseSpec(t).questions);
    expect(out).toContain('### Subtasks');
    expect(out).toContain('### Open questions');
  });
  it('closes an unbalanced code fence so the kept sections survive', () => {
    for (const open of ['```', '~~~']) {
      const out = replaceSpecBody(t, `x\n${open}\ncode`);
      expect(parseSpec(out).subtasks.length).toBe(parseSpec(t).subtasks.length);
      expect(parseSpec(out).questions).toEqual(parseSpec(t).questions);
      expect(keptBlocks(out)).toBe(keptBlocks(t));
      expect(specBodyMd(out)).not.toContain('- [ ] 1.');
      if (eol === '\r\n') expect(/(?<!\r)\n/.test(out)).toBe(false);
    }
  });
  it('demotes a pasted Spec heading', () => {
    const out = replaceSpecBody(t, '## Spec\nfoo');
    expect(parseSpec(out).specMd).toContain('foo');
    expect(out).toContain('### Spec');
  });
});

describe('replaceSpecBody edge cases', () => {
  it('works without a Spec heading or kept sections', () => {
    const t = '---\nid: T-9\ntitle: X\n---\n\nold\n';
    expect(replaceSpecBody(t, specBodyMd(t))).toBe(t);
    expect(replaceSpecBody(t, 'new\n\n## Features\n- a')).toBe('---\nid: T-9\ntitle: X\n---\n\nnew\n\n## Features\n- a\n');
  });
  it('keeps a file without a final newline that way', () => {
    const t = '---\nid: T-9\ntitle: X\n---\n\n## Spec\n\nold';
    expect(replaceSpecBody(t, 'new')).toBe('---\nid: T-9\ntitle: X\n---\n\n## Spec\n\nnew');
  });
  it('leaves everything from Open questions onward when nothing follows it', () => {
    const t = '---\nid: T-9\ntitle: X\n---\n\n## Spec\n\nold\n\n## Open questions\n\n## Subtasks\n\n- [ ] 1. a\n';
    expect(fromKept(replaceSpecBody(t, 'new'))).toBe(fromKept(t));
  });
});

describe('setConfigReferences', () => {
  it('changes only the references lines', () => {
    const out = setConfigReferences(configText, ['CLAUDE.md', 'docs/X.md']);
    const lines = out.split('\n');
    const orig = configText.split('\n');
    expect(lines[2]).toBe('references: [CLAUDE.md, docs/X.md]');
    // Everything before and after the old references block is untouched.
    expect(lines.slice(0, 2)).toEqual(orig.slice(0, 2));
    expect(lines.slice(3)).toEqual(orig.slice(orig.indexOf('---', 1)));
  });
  it('handles empty lists, a missing key and CRLF', () => {
    expect(setConfigReferences('---\nname: A\nreferences: [b]\n---\n', [])).toBe('---\nname: A\nreferences: []\n---\n');
    expect(setConfigReferences('---\nname: A\n---\nbody\n', ['x'])).toBe('---\nname: A\nreferences: [x]\n---\nbody\n');
    const crlf = '---\r\nname: A\r\nreferences:\r\n  - b\r\n---\r\n';
    expect(setConfigReferences(crlf, ['x', 'y'])).toBe('---\r\nname: A\r\nreferences: [x, y]\r\n---\r\n');
  });
});

describe('compareIds', () => {
  it('compares numerically', () => {
    expect(['T-1000', 'T-999', 'T-101'].sort(compareIds)).toEqual(['T-101', 'T-999', 'T-1000']);
  });
});

describe('writeSiblingDraft', () => {
  it('writes <base>.draft.md next to the file and overwrites', async () => {
    const dir = await tmp();
    const out = await writeSiblingDraft(path.join(dir, 'spec.md'), 'x');
    expect(out).toBe(path.join(dir, 'spec.draft.md'));
    expect(await fs.readFile(out, 'utf8')).toBe('x');
    await writeSiblingDraft(path.join(dir, 'spec.md'), 'y');
    expect(await fs.readFile(out, 'utf8')).toBe('y');
  });
});

describe('loadProject', () => {
  it('fills bodyMd', async () => {
    const root = await tmp();
    await fs.cp(sample, root, { recursive: true });
    const s = (await loadProject(root)).specs.find((x) => x.id === 'T-104')!;
    expect(s.bodyMd).toBe(specBodyMd(await fs.readFile(s.path, 'utf8')));
  });
  it('retries reads on EBUSY', async () => {
    const root = await tmp();
    await fs.cp(sample, root, { recursive: true });
    const real = fs.readFile.bind(fs) as (...a: unknown[]) => Promise<unknown>;
    let failed = 0;
    vi.spyOn(fs, 'readFile').mockImplementation(((f: unknown, ...rest: unknown[]) => {
      if (String(f).endsWith('config.md') && failed < 2) {
        failed++;
        return Promise.reject(Object.assign(new Error('busy'), { code: 'EBUSY' }));
      }
      return real(f, ...rest);
    }) as never);
    const p = await loadProject(root);
    expect(failed).toBe(2);
    expect(p.config).not.toBeNull();
    expect(p.problems).toEqual([]);
  });
});
