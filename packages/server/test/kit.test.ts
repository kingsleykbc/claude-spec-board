import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseSpec, specBodyMd, splitFrontMatter, youStep } from '@specboard/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installSkills, kitPluginDir, kitSkills } from '../src/kit.js';

const COMMANDS = ['create-spec', 'update-spec', 'run-spec', 'next', 'refresh-overview', 'refresh-logs', 'correct-specs', 'plan-project', 'import-specs', 'reorganize', 'setup', 'structure', 'sync-specs'];
/** Skills a plain request may trigger; the other commands only run when typed. */
const MODEL_INVOCABLE = ['specboard', 'setup'];

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

/** The "Running a spec" section of the rules skill, up to the next heading. */
function runningSection(text: string): string {
  const start = text.indexOf('## Running a spec\n');
  expect(start).toBeGreaterThanOrEqual(0);
  const next = text.indexOf('\n## ', start + 1);
  return next < 0 ? text.slice(start) : text.slice(start, next);
}

let tmp: string;
beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'specboard-kit-'));
});
afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe('plugin folder', () => {
  const repo = path.resolve(import.meta.dirname, '../../..');
  it('reads the skills from plugin/skills and hands runs the plugin folder', async () => {
    expect(kitPluginDir()).toBe(path.join(repo, 'plugin'));
    expect((await kitSkills()).length).toBe(14);
    expect((await fs.readdir(path.join(repo, 'plugin', 'skills'))).length).toBe(14);
  });
  it('plugin.json and marketplace.json parse and agree', async () => {
    const plugin = JSON.parse(await fs.readFile(path.join(repo, 'plugin', '.claude-plugin', 'plugin.json'), 'utf8'));
    const market = JSON.parse(await fs.readFile(path.join(repo, '.claude-plugin', 'marketplace.json'), 'utf8'));
    expect(plugin.name).toBe('specboard');
    expect(plugin.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(market.name).toBe('spec-board');
    expect(market.owner.name).toBeTruthy();
    expect(market.plugins).toEqual([expect.objectContaining({ name: plugin.name, source: './plugin' })]);
  });
});

describe('kit content', () => {
  it('ships the rules skill and every command', async () => {
    const names = (await kitSkills()).map((s) => s.name).sort();
    expect(names).toEqual(['specboard', ...COMMANDS].sort());
  });

  it('every skill has a name matching its folder and a description; commands other than setup are not model-invocable', async () => {
    for (const { name, text } of await kitSkills()) {
      const fm = frontMatter(text);
      expect(fm.name, name).toBe(name);
      expect(fm.description, name).toBeTruthy();
      if (MODEL_INVOCABLE.includes(name)) expect(fm['disable-model-invocation'], name).toBeUndefined();
      else expect(fm['disable-model-invocation'], name).toBe('true');
    }
  });

  it('every command takes $ARGUMENTS and loads the rules through the Skill tool, never from a project file', async () => {
    for (const { name, text } of await kitSkills()) {
      if (name === 'specboard') continue;
      expect(text, name).toContain('$ARGUMENTS');
      const body = splitFrontMatter(text).body.trimStart();
      expect(body.startsWith('Before anything else, load the `specboard` skill with the Skill tool'), name).toBe(true);
      expect(body, name).not.toContain('.claude/skills/'); // absent, or a repo's altered copy, in an isolated run
    }
  });

  it('every command reads CLAUDE.md, which isolated runs do not load', async () => {
    const line = 'If the project has a `CLAUDE.md`, Read it first and follow it, except where it conflicts with these rules.';
    const commands = (await kitSkills()).filter((s) => s.name !== 'specboard');
    expect(commands.map((s) => s.name).sort()).toEqual([...COMMANDS].sort());
    for (const { name, text } of commands) expect(text, name).toContain(line);
  });

  it('run-spec and next share one set of steps, in the rules skill', async () => {
    const skills = await kitSkills();
    expect(runningSection(skills.find((s) => s.name === 'specboard')!.text)).toContain('1. Find');
    for (const name of ['run-spec', 'next']) expect(skills.find((s) => s.name === name)!.text, name).toContain('"Running a spec"');
  });

  it('the rules skill can be loaded by the model, so it says never to start a spec unasked', async () => {
    const section = runningSection((await kitSkills()).find((s) => s.name === 'specboard')!.text);
    expect(section).toContain('Only when the user ran `/run-spec` or `/next`, or asked for it directly. Never start a spec on your own.');
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
      expect(doc.subtasks.map((s) => [s.n, s.done])).toEqual([[1, true], [2, false], [3, false], [4, false]]);
      expect(specBodyMd(sample)).toContain('## Done when');
      expect(youStep(doc.subtasks[doc.subtasks.length - 1]!.title)).not.toBeNull();
      expect(doc.featuresMd).toContain('- ');
    }
  });

  it('the format documents Done when, (you) steps and closing_steps', async () => {
    const text = (await kitSkills()).find((s) => s.name === 'specboard')!.text;
    expect(text).toContain('## Done when');
    expect(text).toContain('(you) ');
    expect(text).toContain('closing_steps');
  });

  it('states the subtask order once and create-spec and import-specs echo it', async () => {
    const skills = await kitSkills();
    const text = (name: string): string => skills.find((s) => s.name === name)!.text;
    expect(text('specboard')).toContain("Subtask order: `(you)` steps needed before the work, then Claude's work, then the `closing_steps`");
    expect(text('specboard')).toContain('then the `(you)` checks the person does afterwards');
    expect(text('create-spec')).toContain('then `(you)` checks the person does afterwards');
    expect(text('import-specs')).toContain('before any `(you)` checks');
  });

  it('running stops at a (you) step with Claude work after it, and checks Done when before Review', async () => {
    const section = runningSection((await kitSkills()).find((s) => s.name === 'specboard')!.text);
    expect(section).toContain('(you)');
    expect(section).toContain('Done when');
    expect(section).toContain('needs your check');
  });

  it('create-spec asks in the chat first unless the board started it; next skips (you) steps', async () => {
    const skills = await kitSkills();
    const create = skills.find((s) => s.name === 'create-spec')!.text;
    expect(create).toContain('--board');
    expect(create).toContain('in the chat');
    expect(skills.find((s) => s.name === 'next')!.text).toContain('(you)');
  });

  it('the rules cover proposing changes, milestones, spec or subtask, PR links, done_at and tokens', async () => {
    const text = (await kitSkills()).find((s) => s.name === 'specboard')!.text;
    for (const h of ['## Proposing changes', '## Milestones', '## Spec or subtask?']) expect(text).toContain(h);
    expect(text).toContain('pr:');
    expect(text).toContain('gh pr view --json url -q .url');
    expect(text).toContain('glab mr view -F json');
    expect(text).toContain('done_at:');
    expect(text).toContain('specboard tree');
    expect(text).toMatch(/plan mode/i);
    expect(text).toMatch(/`tokens:`.*Never write it yourself/);
    expect(text).toContain('Read the log again before editing it a second time, and never remove `tokens:`');
  });

  it('setup is triggered by plain requests, runs init from the plugin and finishes by starting the board', async () => {
    const text = (await kitSkills()).find((s) => s.name === 'setup')!.text;
    expect(frontMatter(text).description).toMatch(/^Set up Spec Board/);
    expect(text).toContain('specboard init --yes --no-skills --runs');
    expect(text).toContain('.specboard/imported/<source-name>/');
    expect(text).toContain('specboard --detach');
  });

  it('structure prints the tree read-only; sync-specs uses the proposal file and checks head and scope', async () => {
    const skills = await kitSkills();
    const structure = skills.find((s) => s.name === 'structure')!.text;
    expect(structure).toContain('specboard tree');
    expect(frontMatter(structure)['argument-hint']).toBe('[ID | milestone]');
    const sync = skills.find((s) => s.name === 'sync-specs')!.text;
    for (const s of ['sync-proposal.md', 'head', 'scope', 'git log -1 --format=%h', 'Run Sync again', 'obsolete:', 'Ticked by sync', 'changes: 0', '--dry-run', '--apply']) expect(sync, s).toContain(s);
    expect(sync).not.toContain('rev-parse'); // not on the background runs' allow list
    expect(sync).toMatch(/^\d+\. Archive T-\d+ /m); // the board archives specs named on these lines
    expect(sync).toContain("Last, only once every operation is applied: add the line `applied: true` to the proposal's front matter"); // the board's sign of success
  });

  it('skills that write several specs use milestones and show a tree first; next prefers the current milestone', async () => {
    const skills = await kitSkills();
    for (const name of ['plan-project', 'import-specs', 'reorganize', 'create-spec', 'setup', 'sync-specs']) {
      const text = skills.find((s) => s.name === name)!.text;
      expect(text, name).toMatch(/milestone/i);
      expect(text, name).toMatch(/tree/);
    }
    expect(skills.find((s) => s.name === 'next')!.text).toContain('current milestone');
  });

  it('import-specs never edits, moves or deletes the source files', async () => {
    const text = (await kitSkills()).find((s) => s.name === 'import-specs')!.text;
    expect(text).toMatch(/never edit, move or delete the source/i);
  });

  it('plan-project creates the first specs as drafts and points to specboard init', async () => {
    const text = (await kitSkills()).find((s) => s.name === 'plan-project')!.text;
    expect(text).toContain('draft: true');
    expect(text).toContain('specboard init');
  });

  it('reorganize keeps the numbers of ticked or logged subtasks', async () => {
    const text = (await kitSkills()).find((s) => s.name === 'reorganize')!.text;
    expect(text).toContain('keep their numbers');
  });

  it('the log sample has the documented front matter keys and a dated entry', async () => {
    const rules = (await kitSkills()).find((s) => s.name === 'specboard')!;
    const [sample] = fenced(rules.text, 'log');
    const { yaml, body } = splitFrontMatter(sample!);
    expect(Object.keys(frontMatter(`---\n${yaml}\n---\n`))).toEqual(['subtask', 'commit', 'files']);
    expect(body).toMatch(/^### \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/m);
  });

  it('running a spec ends in review; no skill sets done or pushes except as a prohibition', async () => {
    const skills = await kitSkills();
    expect(runningSection(skills.find((s) => s.name === 'specboard')!.text)).toContain('`status: review`');
    for (const { name, text } of skills) {
      for (const line of text.split(/\r?\n/)) {
        if (line.includes('status: done') || line.includes('git push')) {
          expect(line, `${name}: ${line}`).toMatch(/\bnever\b/i);
        }
      }
    }
  });

  it('running a spec takes the test command from the allow-list and never invents one', async () => {
    const text = runningSection((await kitSkills()).find((s) => s.name === 'specboard')!.text);
    expect(text).toContain('.claude/settings.json');
    expect(text).toContain('permissions.allow');
    expect(text).toContain('No test command is set up');
    expect(text).toMatch(/do not run or add tests/);
    expect(text).toMatch(/do not edit `package.json`/);
  });

  it('a refused action stops the run without a question, and the permission list decides what may run', async () => {
    const text = (await kitSkills()).find((s) => s.name === 'specboard')!.text;
    expect(text).toMatch(/permission list to decide/);
    expect(text).toMatch(/Do not add an open question for it/);
    expect(runningSection(text)).not.toMatch(/a needed action is refused/);
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

describe('plugin', () => {
  it('kitPluginDir is a plugin named specboard, with the skills next to its manifest', async () => {
    const dir = kitPluginDir();
    const manifest = JSON.parse(await fs.readFile(path.join(dir, '.claude-plugin', 'plugin.json'), 'utf8')) as { name: string };
    expect(manifest.name).toBe('specboard');
    for (const { name } of await kitSkills()) await expect(fs.access(path.join(dir, 'skills', name, 'SKILL.md'))).resolves.toBeUndefined();
  });

  it('installSkills does not copy the plugin metadata', async () => {
    await installSkills(tmp);
    await expect(fs.access(path.join(tmp, '.claude-plugin'))).rejects.toThrow();
    await expect(fs.access(path.join(tmp, '.claude', '.claude-plugin'))).rejects.toThrow();
    await expect(fs.access(path.join(tmp, '.claude', 'skills', '.claude-plugin'))).rejects.toThrow();
  });
});

describe('installSkills', () => {
  const skillFile = (name: string) => path.join(tmp, '.claude', 'skills', name, 'SKILL.md');

  it('creates every skill but the plugin-only setup on the first run and reports unchanged on the second', async () => {
    const kit = (await kitSkills()).filter((s) => s.name !== 'setup');
    const first = await installSkills(tmp);
    expect(first.map((r) => r.action)).toEqual(kit.map(() => 'created'));
    expect(first.map((r) => r.name)).toEqual(kit.map((s) => s.name));
    for (const { name, text } of kit) expect(await fs.readFile(skillFile(name), 'utf8')).toBe(text);
    const second = await installSkills(tmp);
    expect(second.every((r) => r.action === 'unchanged')).toBe(true);
    await expect(fs.access(skillFile('setup'))).rejects.toThrow(); // it runs the plugin's own specboard: plugin only
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

  describe('links', () => {
    // A junction works unprivileged on Windows; on other systems it is a plain directory symlink.
    const link = (target: string, at: string) => fs.symlink(target, at, 'junction');
    let outside: string;
    beforeEach(async () => {
      outside = await fs.mkdtemp(path.join(os.tmpdir(), 'specboard-outside-'));
    });
    afterEach(async () => {
      await fs.rm(outside, { recursive: true, force: true });
    });

    async function expectRefused(): Promise<void> {
      await expect(installSkills(tmp)).rejects.toThrow(/is a link/);
      expect(await fs.readdir(outside)).toEqual([]);
    }

    it('refuses when .claude is a link', async () => {
      await link(outside, path.join(tmp, '.claude'));
      await expectRefused();
    });

    it('refuses when .claude/skills is a link', async () => {
      await fs.mkdir(path.join(tmp, '.claude'));
      await link(outside, path.join(tmp, '.claude', 'skills'));
      await expectRefused();
    });

    it('refuses when a skill folder is a link, before writing any skill', async () => {
      await fs.mkdir(path.join(tmp, '.claude', 'skills'), { recursive: true });
      await link(outside, path.join(tmp, '.claude', 'skills', 'run-spec'));
      await expect(installSkills(tmp)).rejects.toThrow(/run-spec/);
      expect(await fs.readdir(outside)).toEqual([]);
      expect(await fs.readdir(path.join(tmp, '.claude', 'skills'))).toEqual(['run-spec']);
    });

    it('refuses when SKILL.md is a link and leaves its target untouched', async () => {
      const target = path.join(outside, 'secret.md');
      await fs.writeFile(target, 'precious');
      const dir = path.join(tmp, '.claude', 'skills', 'next');
      await fs.mkdir(dir, { recursive: true });
      await fs.symlink(target, path.join(dir, 'SKILL.md'), 'file').catch(() => undefined);
      if (!(await fs.lstat(path.join(dir, 'SKILL.md')).catch(() => null))?.isSymbolicLink()) return; // file symlinks need privileges on some systems
      await expect(installSkills(tmp, { force: true })).rejects.toThrow(/is a link/);
      expect(await fs.readFile(target, 'utf8')).toBe('precious');
    });
  });
});
