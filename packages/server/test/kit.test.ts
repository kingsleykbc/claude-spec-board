import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseSpec, splitFrontMatter } from '@specboard/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installSkills, kitSkills } from '../src/kit.js';

const COMMANDS = ['create-spec', 'update-spec', 'run-spec', 'next', 'refresh-overview', 'refresh-logs', 'correct-specs'];

/** Read the flat `key: value` lines of a SKILL.md front matter. */
function frontMatter(text: string): Record<string, string> {
  const { yaml } = splitFrontMatter(text);
  const out: Record<string, string> = {};
  for (const line of (yaml ?? '').split(/\r?\n/)) {
    const m = /^([\w-]+):\s*(.*)$/.exec(line);
    if (m) out[m[1]!] = m[2]!;
  }
  return out;
}

/** Contents of the ```<lang> fenced blocks in a skill. */
function fenced(text: string, lang: string): string[] {
  return [...text.matchAll(new RegExp('```' + lang + '\\r?\\n([\\s\\S]*?)```', 'g'))].map((m) => m[1]!);
}

let tmp: string;
beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'specboard-kit-'));
});
afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe('kit content', () => {
  it('ships the rules skill and every command', async () => {
    const names = (await kitSkills()).map((s) => s.name).sort();
    expect(names).toEqual(['specboard', ...COMMANDS].sort());
  });

  it('every skill has a name matching its folder and a description; commands are not model-invocable', async () => {
    for (const { name, text } of await kitSkills()) {
      const fm = frontMatter(text);
      expect(fm.name, name).toBe(name);
      expect(fm.description, name).toBeTruthy();
      if (name === 'specboard') expect(fm['disable-model-invocation'], name).toBeUndefined();
      else expect(fm['disable-model-invocation'], name).toBe('true');
    }
  });

  it('every command takes $ARGUMENTS and reads the specboard rules before its steps', async () => {
    for (const { name, text } of await kitSkills()) {
      if (name === 'specboard') continue;
      expect(text, name).toContain('$ARGUMENTS');
      const body = splitFrontMatter(text).body;
      const readAt = body.indexOf('.claude/skills/specboard/SKILL.md');
      expect(readAt, name).toBeGreaterThanOrEqual(0);
      expect(readAt, name).toBeLessThan(body.indexOf('## Steps'));
    }
  });

  it('spec samples in the specboard skill parse with core and give no problems', async () => {
    const rules = (await kitSkills()).find((s) => s.name === 'specboard')!;
    const samples = fenced(rules.text, 'spec');
    expect(samples.length).toBeGreaterThanOrEqual(1);
    for (const sample of samples) {
      const doc = parseSpec(sample);
      expect(doc.problems).toEqual([]);
      expect(doc.id).toBe('T-001');
      expect(doc.dependsOn).toEqual(['T-000']);
      expect(doc.questions.map((q) => q.type)).toEqual(['yesno', 'number', 'choice', 'text']);
      expect(doc.questions[2]!.options).toEqual(['Email', 'SMS', 'Both']);
      expect(doc.questions[1]!.answer).toBe('14');
      expect(doc.questions[0]!.answer).toBeNull();
      expect(doc.subtasks.map((s) => [s.n, s.done])).toEqual([[1, true], [2, false], [3, false]]);
      expect(doc.featuresMd).toContain('- ');
    }
  });

  it('the log sample has the documented front matter keys and a dated entry', async () => {
    const rules = (await kitSkills()).find((s) => s.name === 'specboard')!;
    const [sample] = fenced(rules.text, 'log');
    const { yaml, body } = splitFrontMatter(sample!);
    expect(Object.keys(frontMatter(`---\n${yaml}\n---\n`))).toEqual(['subtask', 'commit', 'files']);
    expect(body).toMatch(/^### \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/m);
  });

  it('run-spec ends in review; no skill sets done or pushes except as a prohibition', async () => {
    const skills = await kitSkills();
    expect(skills.find((s) => s.name === 'run-spec')!.text).toContain('status: review');
    for (const { name, text } of skills) {
      for (const line of text.split(/\r?\n/)) {
        if (line.includes('status: done') || line.includes('git push')) {
          expect(line, `${name}: ${line}`).toMatch(/\bnever\b/i);
        }
      }
    }
  });

  it('no skill tells Claude to run shell commands outside the default allow-list', async () => {
    for (const { name, text } of await kitSkills()) {
      const instructions = text
        .split(/\r?\n/)
        .filter((l) => !/\b(do not|never)\b/i.test(l))
        .join('\n');
      expect(instructions, name).not.toMatch(/`(rm|mv|mkdir|cp|echo|git push|git checkout|git reset|git branch)\b/);
    }
  });
});

describe('installSkills', () => {
  const skillFile = (name: string) => path.join(tmp, '.claude', 'skills', name, 'SKILL.md');

  it('creates every skill on the first run and reports unchanged on the second', async () => {
    const kit = await kitSkills();
    const first = await installSkills(tmp);
    expect(first.map((r) => r.action)).toEqual(kit.map(() => 'created'));
    expect(first.map((r) => r.name)).toEqual(kit.map((s) => s.name));
    for (const { name, text } of kit) expect(await fs.readFile(skillFile(name), 'utf8')).toBe(text);
    const second = await installSkills(tmp);
    expect(second.every((r) => r.action === 'unchanged')).toBe(true);
  });

  it('skips a file the user edited unless force is set, then updates it', async () => {
    await installSkills(tmp);
    const edited = (await fs.readFile(skillFile('run-spec'), 'utf8')) + '\nMy own rule.\n';
    await fs.writeFile(skillFile('run-spec'), edited);

    const skipped = await installSkills(tmp);
    expect(skipped.find((r) => r.name === 'run-spec')!.action).toBe('skipped-modified');
    expect(skipped.filter((r) => r.name !== 'run-spec').every((r) => r.action === 'unchanged')).toBe(true);
    expect(await fs.readFile(skillFile('run-spec'), 'utf8')).toBe(edited);

    const forced = await installSkills(tmp, { force: true });
    expect(forced.find((r) => r.name === 'run-spec')!.action).toBe('updated');
    const kit = await kitSkills();
    expect(await fs.readFile(skillFile('run-spec'), 'utf8')).toBe(kit.find((s) => s.name === 'run-spec')!.text);
  });

  it('treats line-ending differences as unchanged and leaves such a file alone', async () => {
    await installSkills(tmp);
    const text = await fs.readFile(skillFile('next'), 'utf8');
    const crlf = text.replace(/\n/g, '\r\n');
    await fs.writeFile(skillFile('next'), crlf);
    const results = await installSkills(tmp);
    expect(results.find((r) => r.name === 'next')!.action).toBe('unchanged');
    expect(await fs.readFile(skillFile('next'), 'utf8')).toBe(crlf);
  });

  it('kitSkills text uses LF even if the kit files were checked out with CRLF', async () => {
    for (const { text } of await kitSkills()) expect(text).not.toContain('\r');
  });

  it('leaves files outside .claude/skills/<name>/SKILL.md untouched', async () => {
    const others = [
      path.join(tmp, 'README.md'),
      path.join(tmp, '.claude', 'settings.json'),
      path.join(tmp, '.claude', 'skills', 'my-own', 'SKILL.md'),
      path.join(tmp, '.claude', 'skills', 'run-spec', 'notes.md'),
    ];
    for (const f of others) {
      await fs.mkdir(path.dirname(f), { recursive: true });
      await fs.writeFile(f, `keep ${path.basename(f)}`);
    }
    await installSkills(tmp, { force: true });
    for (const f of others) expect(await fs.readFile(f, 'utf8')).toBe(`keep ${path.basename(f)}`);
  });
});
