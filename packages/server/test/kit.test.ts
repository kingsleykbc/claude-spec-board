import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseSpec, specBodyMd, splitFrontMatter, youStep } from '@specboard/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installSkills, kitPluginDir, kitSkills } from '../src/kit.js';

const COMMANDS = ['create-spec', 'update-spec', 'run-spec', 'next', 'refresh-overview', 'refresh-questions', 'refresh-logs', 'correct-specs', 'plan-project', 'import-specs', 'reorganize', 'setup', 'structure', 'sync-specs', 'move', 'fix-review'];
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
    expect((await kitSkills()).length).toBe(17);
    expect((await fs.readdir(path.join(repo, 'plugin', 'skills'))).length).toBe(17);
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

  it('every ../<name>/SKILL.md path a skill mentions exists in plugin/skills', async () => {
    const names = (await fs.readdir(path.resolve(import.meta.dirname, '../../../plugin/skills'))).sort();
    for (const { name, text } of await kitSkills()) {
      for (const m of text.matchAll(/\.\.\/([\w-]+)\/SKILL\.md/g)) expect(names, `${name} -> ${m[0]}`).toContain(m[1]);
    }
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
      expect(doc.subtasks.map((s) => [s.n, s.done])).toEqual([[1, true], [2, false], [3, false]]);
      expect(doc.subtasks.some((s) => youStep(s.title) !== null)).toBe(false); // after-work checks are To review items now
      expect(doc.reviews.map((r) => [r.n, r.done, r.group, r.expected !== null])).toEqual([[1, false, null, true], [2, false, null, true]]);
      expect(specBodyMd(sample)).toContain('## Done when');
      expect(specBodyMd(sample)).not.toContain('## To review');
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
    expect(text('specboard')).toContain('Checks the person does afterwards go in `## To review`, never as `(you)` subtasks at the end.');
    expect(text('create-spec')).toContain('No `(you)` checks at the end.');
    expect(text('create-spec')).toContain('`## To review`: the checks the person does once the work is done');
    expect(text('import-specs')).toContain('→ `## To review`');
    expect(text('import-specs')).not.toContain('before any `(you)` checks');
  });

  it('running stops at a (you) step with Claude work after it, and checks Done when before Review', async () => {
    const section = runningSection((await kitSkills()).find((s) => s.name === 'specboard')!.text);
    expect(section).toContain('(you)');
    expect(section).toContain('Done when');
    expect(section).not.toContain('needs your check');
    expect(section).toContain('A line you cannot check yourself goes to `## To review` as an item');
    expect(section).toContain('in an older spec'); // trailing (you) checks still work
    expect(section).toContain('list the open To review items');
    expect(section).toContain('Never tick them.');
  });

  it('the format documents To review: grammar, where after-work checks go, and that Claude never ticks them', async () => {
    const text = (await kitSkills()).find((s) => s.name === 'specboard')!.text;
    expect(text).toContain('`## Subtasks`, `## To review`');
    expect(text).toContain('`## To review` comes after `## Subtasks`');
    expect(text).toContain('They go here, not as `(you)` subtasks at the end.');
    expect(text).toContain('Use it only for something the person must do before or during the work.');
    expect(text).toContain('A small spec has 1 to 3 plain items. A larger spec has groups of steps, each with an `expected` line.');
    expect(text).toContain('Claude never ticks a To review item.');
    expect(text).toContain('becomes a `## To review` item instead');
    expect(text).toContain('Older specs may still end with `(you)` check subtasks.');
    // The grammar example parses: a group, expected lines, nothing in the editable body.
    const block = /```\n(## To review\n[\s\S]*?)```/.exec(text)![1]!;
    const doc = parseSpec(`---\nid: T-001\ntitle: Tasks\nstatus: todo\n---\n\n## Spec\nA list.\n\n${block}`);
    expect(doc.problems).toEqual([]);
    expect(doc.reviews.map((r) => [r.group, r.text, r.expected])).toEqual([
      ['Adding tasks', 'Add a task with the Enter key', 'It appears at the bottom of the list and the box clears.'],
      ['Adding tasks', 'Reload the page', 'The task is still there.'],
    ]);
  });

  it('the format documents the step, failed and fixed lines, and the grammar example parses with steps', async () => {
    const text = (await kitSkills()).find((s) => s.name === 'specboard')!.text;
    expect(text).toContain('`  > step: <one step>`');
    expect(text).toContain('`  > failed: <reason>`');
    expect(text).toContain('`  > fixed: <reason> (<commit or "no commit">)`');
    expect(text).toContain('Setup first');
    expect(text).toContain('Only the board writes `> failed:`');
    expect(text).toContain('Never tick a To review item, and never remove or reword a `> failed:` or `> fixed:` line, except as /fix-review says.');
    const block = /```\n(## To review\n[\s\S]*?)```/.exec(text)![1]!;
    const doc = parseSpec(`---\nid: T-001\ntitle: Tasks\nstatus: todo\n---\n\n## Spec\nA list.\n\n${block}`);
    expect(doc.problems).toEqual([]);
    expect(doc.reviews[0]!.steps.length).toBeGreaterThanOrEqual(2);
    expect(doc.reviews.every((r) => r.expected !== null)).toBe(true);
    for (const sample of fenced(text, 'spec')) expect(parseSpec(sample).reviews.every((r) => r.steps.length > 0)).toBe(true);
  });

  it('writing a good spec, create-spec and import-specs give every To review item its steps, setup first', async () => {
    const skills = await kitSkills();
    const get = (name: string) => skills.find((s) => s.name === name)!.text;
    expect(get('specboard')).toContain('Every To review item gets `> step:` lines');
    expect(get('specboard')).toContain('the `test_command`, the start script in `package.json`');
    for (const name of ['create-spec', 'import-specs']) {
      expect(get(name), name).toContain('`  > step:` lines');
      expect(get(name), name).toContain('"Writing a good spec"');
    }
  });

  it('fix-review: a command for one ID that fixes failed checks as new subtasks and never ticks To review items', async () => {
    const skills = await kitSkills();
    const get = (name: string) => skills.find((s) => s.name === name)!.text;
    const fix = get('fix-review');
    expect(frontMatter(fix)['argument-hint']).toBe('<ID>');
    expect(frontMatter(fix)['disable-model-invocation']).toBe('true');
    for (const s of [
      'If no item has failed, say so and stop.',
      'a bug',
      'a change of mind',
      'update `## Features` and `## Done when` to match',
      'one question at a time',
      'add a required open question and stop without changing code',
      '`Fix: <reason, shortened> (review item <n>)`',
      'Never renumber existing subtasks.',
      '`status: doing`',
      '"Running a spec"',
      '`> fixed: <reason> (<commit>)`',
      'Never tick To review items.',
      'specs_in_git',
      '`status: review`',
    ]) expect(fix, s).toContain(s);
    const rules = get('specboard');
    expect(rules).toContain('follow `../fix-review/SKILL.md`');
    expect(runningSection(rules)).toContain('point the person to `/fix-review <ID>`');
    expect(get('sync-specs')).toContain('Keep every `> failed:` and `> fixed:` line as it is.');
  });

  it('the rules read linked images and attachments, and archive with specboard archive or the card menu', async () => {
    const text = (await kitSkills()).find((s) => s.name === 'specboard')!.text;
    expect(text).toContain('are **attachments**');
    expect(text).toContain('Read every image its text links and every attachment in its `images/` folder');
    expect(runningSection(text)).toContain('its images (the linked ones and the attachments');
    expect(text).toContain('## Archiving');
    expect(text).toContain('Run `specboard archive <ID> "<project folder>"` on its own with the Bash tool');
    expect(text).toContain('If it fails for any reason, tell the person to use Archive');
    expect(text).toContain('`specboard copy-images <from ID> <to ID> "<project folder>"`');
    expect(text).toContain('or archive a spec.');
    expect(text).toContain("tell the person to use Archive in the card's ⋯ menu");
    expect(text).toMatch(/Six exceptions are optional[^\n]*`specboard tree`, `specboard archive`[^\n]*`specboard copy-images`[^\n]*the board commit/);
  });

  it('skills that write or change specs keep To review; reorganize and chat sync archive with specboard archive; next skips review-only specs', async () => {
    const skills = await kitSkills();
    const text = (name: string): string => skills.find((s) => s.name === name)!.text;
    for (const name of ['create-spec', 'plan-project', 'import-specs', 'update-spec', 'refresh-questions', 'correct-specs', 'reorganize', 'sync-specs', 'next']) {
      expect(text(name), name).toContain('## To review');
    }
    expect(text('update-spec')).toContain('Keep `## To review` and its ticks');
    expect(text('refresh-questions')).toContain('Never drop the `## To review` section.');
    expect(text('correct-specs')).toContain('never tick, untick or drop them');
    expect(text('reorganize')).toContain('archive it with `specboard archive <ID> "<project folder>"`');
    expect(text('reorganize')).toContain('specboard copy-images <other ID> <kept ID> "<project folder>"');
    expect(text('reorganize')).toContain('do not archive the other card');
    expect(text('reorganize')).toContain('specboard copy-images <original ID> <new ID>');
    expect(text('move')).toContain('unticked `## To review` items');
    expect(text('reorganize')).not.toContain('A merge archives nothing by itself');
    const chat = text('sync-specs').slice(text('sync-specs').indexOf('## In a chat'));
    expect(chat).toContain('run `specboard archive <ID> "<project folder>"` for each `Archive <ID>` line');
    expect(text('sync-specs')).toContain('the board archives the spec'); // board mode unchanged
    expect(text('next')).toContain("only open work is `## To review` items");
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
    const step7 = text.split('\n').find((l) => l.startsWith('7. **Background runs.**'))!;
    expect(step7).toContain('specboard rules "<folder>"');
    expect(step7).toContain('specboard init --yes --no-skills --runs yes "<folder>"');
    expect(step7).not.toContain('--runs no');
    expect(text.split('\n').find((l) => l.startsWith('1. **Where.**'))).not.toContain('--runs no');
    expect(text).toContain('If it prints that an older board is running');
  });

  it('refresh-overview writes a short plain summary with no IDs, checks sync read-only and may end with ## Out of sync', async () => {
    const skills = await kitSkills();
    const text = (name: string): string => skills.find((s) => s.name === name)!.text;
    const ov = text('refresh-overview');
    for (const s of [
      '1 to 3 short paragraphs in plain words',
      'anything waiting on the person (questions to answer, work to review, checks that failed)',
      'No ticket IDs, file names, or technical detail',
      'no front-matter terms (status, subtask numbers), commands or paths',
      'Lists or bullets only when they really help, for example when four or more things need the person.',
      // The read-only check is self-contained: background runs can't read other skill files.
      'Check, read-only, whether the board and the code are out of sync.',
      'Do not read other skill files for this: background runs can\'t read them.',
      'money as "£10.00", not "1000 cents"',
      'write nothing except `.specboard/overview.md`',
      'end the overview with a section `## Out of sync` holding 1 or 2 plain sentences on what\'s off, with no IDs',
      'Two cards look further along in the code than on the board.',
      'If nothing would change, there is no `## Out of sync` section.',
      'Without a git repo, or when the check can\'t run',
    ]) expect(ov, s).toContain(s);
    expect(ov).not.toContain('how many specs are To-do, Doing, Review and Done'); // the old card-by-card report
    expect(ov).not.toMatch(/\bT-\d+/); // no IDs, not even in examples
    expect(ov).not.toContain('- subtasks to tick'); // the analysis itself stays in sync-specs
    // A project-wide sync removes the section, in board mode before applied: true, and in a chat.
    const sync = text('sync-specs');
    const apply = sync.slice(sync.indexOf('## --board --apply'), sync.indexOf('## In a chat'));
    expect(apply).toContain('5. For a project-wide sync (no `scope`), remove the `## Out of sync` section from `.specboard/overview.md`');
    expect(apply.indexOf('remove the `## Out of sync` section')).toBeLessThan(apply.indexOf('applied: true'));
    expect(sync.slice(sync.indexOf('## In a chat'))).toContain('After a project-wide sync, remove the `## Out of sync` section from `.specboard/overview.md`');
    expect(text('specboard')).toContain('then an optional `## Out of sync` section');
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

  it('plan-project sizes up the work and offers phases without being asked', async () => {
    const text = (await kitSkills()).find((s) => s.name === 'plan-project')!.text;
    expect(text).toContain('about 6 or more specs');
    expect(text).toContain('the person should not have to bring up phases');
    expect(text).toContain('Small project, so no phases.');
    expect(text).toContain('Each message asks exactly one question.');
  });

  it('scenario 2 fixes: drafts run on after write-up, required questions in the chat, PR lookup only with a remote, sync counts, upgrade note', async () => {
    const skills = await kitSkills();
    const get = (name: string) => skills.find((s) => s.name === name)!.text;
    expect(get('create-spec')).toContain('go straight back to the run now, in the same reply');
    expect(get('create-spec')).toContain('A spec written in a chat should not leave required questions on the board.');
    expect(get('specboard')).toContain('continue with the run in the same reply, without waiting for the request again');
    expect(get('specboard')).toMatch(/only when it has a `github\.com` remote, try `gh pr view/);
    expect(get('sync-specs')).toContain('Run `specboard tree` first');
    expect(get('setup')).toContain('Your board was updated to <new version>.');
  });

  it('recheck fixes: a test command background runs can allow, and running a draft asks only the required questions', async () => {
    const skills = await kitSkills();
    const get = (name: string) => skills.find((s) => s.name === name)!.text;
    expect(get('plan-project')).toContain('never an interpreter with flags like `node --test`');
    expect(get('setup')).toContain('If it says it is not allowing the `test_command`');
    expect(get('create-spec')).toContain('ask only the required ones: take the recommendation for every optional one');
  });

  it('specs in git: plan-project and import-specs ask, setup passes the answer to init, the rules commit .specboard on its own', async () => {
    const skills = await kitSkills();
    const get = (name: string) => skills.find((s) => s.name === name)!.text;
    for (const name of ['plan-project', 'import-specs']) {
      expect(get(name), name).toContain('Keep the specs in git?');
      expect(get(name), name).toContain('specs_in_git');
    }
    expect(get('plan-project')).toContain('at most 9');
    expect(get('plan-project')).toMatch(/^\s*\| 9 \| Keep the specs in git\? \|/m);
    const setup = get('setup');
    expect(setup).toContain('--specs-in-git');
    expect(setup.split('\n').find((l) => l.startsWith('5. **Set up.**'))).toContain('--specs-in-git');
    expect(setup.split('\n').find((l) => l.startsWith('8. **Finish.**'))).toMatch(/specs/);
    const rules = get('specboard');
    expect(rules).toContain('specs_in_git');
    expect(rules).toContain('git commit -m "Spec Board: <short summary>" -- .specboard');
    expect(rules).toContain('git add .specboard');
    expect(runningSection(rules)).toContain('specs_in_git');
    expect(rules.split('\n').find((l) => l.startsWith('  config.md'))).toContain('specs_in_git');
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

  it('running a spec takes the test command from config.md and never invents one', async () => {
    const text = runningSection((await kitSkills()).find((s) => s.name === 'specboard')!.text);
    expect(text).toContain('test_command');
    expect(text).not.toContain('.claude/settings.json');
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
