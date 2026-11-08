import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseAllowArgs, parseInitArgs } from '../src/cli.js';
import { projectId } from '../src/registry.js';
import {
  allowCommand,
  ApprovedPermissions,
  defaultAllowList,
  initCommand,
  isValidRule,
  mergeClaudeSettings,
  type SetupIO,
} from '../src/setup.js';

const SAMPLE = path.resolve(import.meta.dirname, '../../../examples/recipe-box');

let tmp: string;
let home: string;
let savedHome: string | undefined;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'sb-setup-'));
  home = path.join(tmp, 'home');
  savedHome = process.env.SPECBOARD_HOME;
  process.env.SPECBOARD_HOME = home;
});
afterEach(async () => {
  if (savedHome === undefined) delete process.env.SPECBOARD_HOME;
  else process.env.SPECBOARD_HOME = savedHome;
  await fs.rm(tmp, { recursive: true, force: true });
});

async function project(name = 'proj', pkg?: object): Promise<string> {
  const dir = path.join(tmp, name);
  await fs.mkdir(dir, { recursive: true });
  if (pkg) await fs.writeFile(path.join(dir, 'package.json'), JSON.stringify(pkg));
  return dir;
}

function io(opts: { tty?: boolean; answer?: boolean } = {}): SetupIO & { out: string[]; asked: string[] } {
  const out: string[] = [];
  const asked: string[] = [];
  return {
    isTTY: opts.tty ?? true,
    confirm: async (q) => {
      asked.push(q);
      return opts.answer ?? true;
    },
    log: (l) => out.push(l),
    out,
    asked,
  };
}

const readJson = async (f: string) => JSON.parse(await fs.readFile(f, 'utf8'));
const approvedFile = () => path.join(home, 'permissions.json');
const init = (root: string) => initCommand({ root, yes: true, forceSkills: false }, io());

describe('isValidRule', () => {
  it.each([
    '', '   ', '*', 'Bash(*)', 'Bash', 'Bash(:*)', 'Bash(*:*)', 'PowerShell', 'PowerShell(*)', 'Read', 'Edit', 'Write',
    'Edit(*)', 'Write(**)', 'Bash(git\nstatus)', 'Bash(a)\r', 'bad rule', 'Bash(git status',
  ])('rejects %j', (r) => expect(isValidRule(r)).toBe(false));
  it.each(['Bash(npm test:*)', 'Read(./**)', 'Edit(./src/**)', 'Glob', 'Grep', 'WebFetch', 'PowerShell(npm test:*)'])('accepts %s', (r) =>
    expect(isValidRule(r)).toBe(true),
  );
});

describe('defaultAllowList', () => {
  it('has no git push allow, and detects npm test only when the script exists', async () => {
    const a = await defaultAllowList(await project('a'));
    expect(a.allow.some((r) => r.includes('git push'))).toBe(false);
    expect(a.deny).toEqual(
      expect.arrayContaining([
        'Bash(git push:*)', 'Bash(git reset:*)', 'Bash(rm -rf:*)', 'PowerShell(git push:*)', 'PowerShell(git reset:*)',
        'Edit(./.claude/**)', 'Write(./.claude/**)',
      ]),
    );
    expect(a.allow).toEqual(expect.arrayContaining(['Read(./**)', 'Edit(./**)', 'Write(./**)', 'Bash(git commit:*)']));
    expect(a.allow).not.toContain('Bash(npm test:*)');
    const b = await defaultAllowList(await project('b', { scripts: { test: 'vitest' } }));
    expect(b.allow).toEqual(expect.arrayContaining(['Bash(npm test:*)', 'Bash(npm run test:*)']));
    const c = await defaultAllowList(await project('c', { scripts: { build: 'x' } }));
    expect(c.allow).not.toContain('Bash(npm test:*)');
  });
  it('detects pytest, cargo and go', async () => {
    const d = await project('d');
    await fs.writeFile(path.join(d, 'pytest.ini'), '');
    await fs.writeFile(path.join(d, 'Cargo.toml'), '');
    await fs.writeFile(path.join(d, 'go.mod'), '');
    expect((await defaultAllowList(d)).allow).toEqual(expect.arrayContaining(['Bash(pytest:*)', 'Bash(cargo test:*)', 'Bash(go test:*)']));
  });
  it('ignores a malformed package.json', async () => {
    const d = await project('e');
    await fs.writeFile(path.join(d, 'package.json'), '{nope');
    expect((await defaultAllowList(d)).allow).not.toContain('Bash(npm test:*)');
  });
  it('never offers a rule that meets its own deny list', async () => {
    const p = await defaultAllowList(await project('f', { scripts: { test: 'x' } }));
    await expect(new ApprovedPermissions(approvedFile()).set('abcd1234', p)).resolves.toBeUndefined();
  });
});

describe('mergeClaudeSettings', () => {
  const p = { allow: ['Read(./**)', 'Bash(git status:*)'], deny: ['Bash(git push:*)'] };
  it('keeps existing keys and rules, adds ours without duplicates', async () => {
    const root = await project();
    await fs.mkdir(path.join(root, '.claude'));
    const file = path.join(root, '.claude', 'settings.json');
    await fs.writeFile(file, JSON.stringify({ model: 'x', permissions: { allow: ['Bash(ls:*)', 'Read(./**)'], ask: ['Bash(rm:*)'] } }));
    await mergeClaudeSettings(root, p);
    await mergeClaudeSettings(root, p);
    const s = await readJson(file);
    expect(s.model).toBe('x');
    expect(s.permissions.ask).toEqual(['Bash(rm:*)']);
    expect(s.permissions.allow).toEqual(['Bash(ls:*)', 'Read(./**)', 'Bash(git status:*)']);
    expect(s.permissions.deny).toEqual(['Bash(git push:*)']);
  });
  it('creates the file when missing', async () => {
    const root = await project();
    await mergeClaudeSettings(root, p);
    expect((await readJson(path.join(root, '.claude', 'settings.json'))).permissions.allow).toEqual(p.allow);
  });
  it('refuses to overwrite invalid JSON, naming the file, and leaves it unchanged', async () => {
    const root = await project();
    await fs.mkdir(path.join(root, '.claude'));
    const file = path.join(root, '.claude', 'settings.json');
    await fs.writeFile(file, '{ "permissions": ');
    await expect(mergeClaudeSettings(root, p)).rejects.toThrow(/settings\.json/);
    expect(await fs.readFile(file, 'utf8')).toBe('{ "permissions": ');
  });
  it('refuses a settings.json whose permissions are not lists', async () => {
    const root = await project();
    await fs.mkdir(path.join(root, '.claude'));
    const file = path.join(root, '.claude', 'settings.json');
    await fs.writeFile(file, '{"permissions":{"allow":"Bash(*)"}}');
    await expect(mergeClaudeSettings(root, p)).rejects.toThrow(/settings\.json/);
    expect(await fs.readFile(file, 'utf8')).toBe('{"permissions":{"allow":"Bash(*)"}}');
  });
  it('refuses to write through a linked .claude folder', async () => {
    const outside = path.join(tmp, 'outside');
    await fs.mkdir(outside);
    const root = await project('r1');
    await fs.symlink(outside, path.join(root, '.claude'), 'junction');
    await expect(mergeClaudeSettings(root, p)).rejects.toThrow(/link/);
    expect(await fs.readdir(outside)).toEqual([]);
  });
  it('refuses to write through a linked settings.json', async () => {
    const outside = path.join(tmp, 'outside');
    await fs.mkdir(outside);
    const target = path.join(outside, 'target.json');
    await fs.writeFile(target, '{}');
    const root = await project('r2');
    await fs.mkdir(path.join(root, '.claude'));
    try {
      await fs.symlink(target, path.join(root, '.claude', 'settings.json'), 'file');
    } catch {
      return; // file symlinks need privileges on Windows; the junction test covers the folder case
    }
    await expect(mergeClaudeSettings(root, p)).rejects.toThrow(/link/);
    expect(await fs.readFile(target, 'utf8')).toBe('{}');
  });
});

describe('ApprovedPermissions', () => {
  const p = { allow: ['Read(./**)', 'Bash(git status:*)'], deny: ['Bash(git push:*)'] };
  it('returns null when nothing is approved, and round-trips by project id', async () => {
    const s = new ApprovedPermissions(approvedFile());
    expect(await s.get('aaaaaaaa')).toBeNull();
    await s.set('aaaaaaaa', p);
    await s.set('bbbbbbbb', { allow: ['Glob'], deny: [] });
    expect(await s.get('aaaaaaaa')).toEqual(p);
    expect(await s.get('bbbbbbbb')).toEqual({ allow: ['Glob'], deny: [] });
  });
  it('addAllow adds once, and needs an existing entry', async () => {
    const s = new ApprovedPermissions(approvedFile());
    await expect(s.addAllow('aaaaaaaa', 'Bash(npm test:*)')).rejects.toThrow(/not approved|init/i);
    await s.set('aaaaaaaa', p);
    await s.addAllow('aaaaaaaa', 'Bash(npm test:*)');
    await s.addAllow('aaaaaaaa', 'Bash(npm test:*)');
    expect((await s.get('aaaaaaaa'))!.allow).toEqual([...p.allow, 'Bash(npm test:*)']);
  });
  it.each(['Bash(git push:*)', 'Bash(git:*)', 'Bash(GIT.exe push:*)', 'PowerShell(git push origin:*)', 'Write(./.claude/**)'])(
    'addAllow refuses %s as blocked by policy',
    async (rule) => {
      const s = new ApprovedPermissions(approvedFile());
      await s.set('aaaaaaaa', { allow: ['Read(./**)'], deny: ['Bash(git push:*)', 'Write(./.claude/**)'] });
      await expect(s.addAllow('aaaaaaaa', rule)).rejects.toThrow(/blocked by policy/);
      expect((await s.get('aaaaaaaa'))!.allow).toEqual(['Read(./**)']);
    },
  );
  it('addAllow and set refuse invalid rules and rules that meet the deny list', async () => {
    const s = new ApprovedPermissions(approvedFile());
    await s.set('aaaaaaaa', p);
    await expect(s.addAllow('aaaaaaaa', 'Bash(*)')).rejects.toThrow(/valid/i);
    await expect(s.set('aaaaaaaa', { allow: ['Bash(*)'], deny: [] })).rejects.toThrow(/valid/i);
    await expect(s.set('aaaaaaaa', { allow: ['Bash(git push origin:*)'], deny: ['Bash(git push:*)'] })).rejects.toThrow(/blocked by policy/);
  });
  it('a malformed file is an error, never read as empty and never overwritten', async () => {
    await fs.mkdir(home, { recursive: true });
    for (const bad of ['{nope', '[]', '{"aaaaaaaa":{"allow":"x","deny":[]}}']) {
      await fs.writeFile(approvedFile(), bad);
      const s = new ApprovedPermissions(approvedFile());
      await expect(s.get('aaaaaaaa')).rejects.toThrow(/permissions\.json/);
      await expect(s.set('bbbbbbbb', p)).rejects.toThrow(/permissions\.json/);
      await expect(s.addAllow('aaaaaaaa', 'Glob')).rejects.toThrow(/permissions\.json/);
      expect(await fs.readFile(approvedFile(), 'utf8')).toBe(bad);
    }
  });
  it('leaves no temp files behind', async () => {
    await new ApprovedPermissions(approvedFile()).set('aaaaaaaa', p);
    expect(await fs.readdir(home)).toEqual(['permissions.json']);
  });
});

describe('initCommand', () => {
  it('refuses without a TTY and without --yes, changing nothing', async () => {
    const root = await project();
    await expect(initCommand({ root, yes: false, forceSkills: false }, io({ tty: false }))).rejects.toThrow(/--yes|terminal/);
    expect(await fs.readdir(root)).toEqual([]);
    await expect(fs.stat(home)).rejects.toThrow();
  });

  it('--yes completes: project, skills, both permission files, registry', async () => {
    const root = await project('p1', { scripts: { test: 'vitest' } });
    const i = io({ tty: false });
    const r = await initCommand({ root, yes: true, forceSkills: false }, i);
    expect(r.approved).toBe(true);
    expect(i.asked).toEqual([]);
    await fs.stat(path.join(root, '.specboard', 'config.md'));
    await fs.stat(path.join(root, '.claude', 'skills', 'specboard', 'SKILL.md'));
    const settings = await readJson(path.join(root, '.claude', 'settings.json'));
    const approved = await readJson(approvedFile());
    const id = projectId(root);
    expect(approved[id]).toEqual(settings.permissions);
    expect(approved[id].allow).toContain('Bash(npm test:*)');
    expect((await readJson(path.join(home, 'projects.json')))[0].id).toBe(id);
    expect(i.out.join('\n')).toContain('Bash(git push:*)');
  });

  it('is idempotent', async () => {
    const root = await project('p2');
    await init(root);
    const files = [approvedFile(), path.join(root, '.claude', 'settings.json')];
    const before = await Promise.all(files.map((f) => fs.readFile(f, 'utf8')));
    await init(root);
    expect(await Promise.all(files.map((f) => fs.readFile(f, 'utf8')))).toEqual(before);
    expect(await readJson(path.join(home, 'projects.json'))).toHaveLength(1);
  });

  it('keeps rules added later with allow when init runs again', async () => {
    const root = await project('p2b');
    await init(root);
    await allowCommand({ rule: 'Bash(npm run lint:*)', root }, io());
    await init(root);
    expect((await readJson(approvedFile()))[projectId(root)].allow).toContain('Bash(npm run lint:*)');
  });

  it('asks on a TTY; yes approves', async () => {
    const root = await project('p3');
    const i = io({ answer: true });
    const r = await initCommand({ root, yes: false, forceSkills: false }, i);
    expect(i.asked).toEqual(['Allow these actions for headless runs? [y/N] ']);
    expect(r.approved).toBe(true);
  });

  it('no: sets up the project but writes neither permission file', async () => {
    const root = await project('p4');
    const r = await initCommand({ root, yes: false, forceSkills: false }, io({ answer: false }));
    expect(r.approved).toBe(false);
    await fs.stat(path.join(root, '.specboard', 'config.md'));
    await expect(fs.stat(path.join(root, '.claude', 'settings.json'))).rejects.toThrow();
    await expect(fs.stat(approvedFile())).rejects.toThrow();
    expect(await readJson(path.join(home, 'projects.json'))).toHaveLength(1);
  });

  it('fails cleanly and changes nothing further when .claude is a link', async () => {
    const root = await project('p5');
    const outside = path.join(tmp, 'outside');
    await fs.mkdir(path.join(outside, 'skills', 'specboard'), { recursive: true });
    await fs.symlink(outside, path.join(root, '.claude'), 'junction');
    await expect(init(root)).rejects.toThrow(/link/);
    await expect(fs.stat(path.join(root, '.specboard'))).rejects.toThrow();
    await expect(fs.stat(approvedFile())).rejects.toThrow();
    await expect(fs.stat(path.join(home, 'projects.json'))).rejects.toThrow();
    expect(await fs.readdir(path.join(outside, 'skills', 'specboard'))).toEqual([]);
  });

  it('Review Focus 1: a project settings.json allowing Bash(*) does not touch the approved entry', async () => {
    const root = await project('p6');
    const id = projectId(root);
    const store = new ApprovedPermissions(approvedFile());
    await store.set(id, { allow: ['Read(./**)'], deny: ['Bash(git push:*)'] });
    await fs.mkdir(path.join(root, '.claude'));
    await fs.writeFile(path.join(root, '.claude', 'settings.json'), JSON.stringify({ permissions: { allow: ['Bash(*)'] } }));
    expect(await store.get(id)).toEqual({ allow: ['Read(./**)'], deny: ['Bash(git push:*)'] });
    await init(root);
    const got = (await store.get(id))!;
    expect(got.allow).not.toContain('Bash(*)');
    expect(got.allow).toContain('Read(./**)');
  });
});

describe('allowCommand', () => {
  async function inited(name: string): Promise<string> {
    const root = await project(name);
    await init(root);
    return root;
  }

  it('adds the rule to the approved list and to .claude/settings.json', async () => {
    const root = await inited('a1');
    await allowCommand({ rule: 'Bash(npm run lint:*)', root }, io());
    expect((await readJson(approvedFile()))[projectId(root)].allow).toContain('Bash(npm run lint:*)');
    expect((await readJson(path.join(root, '.claude', 'settings.json'))).permissions.allow).toContain('Bash(npm run lint:*)');
  });

  it('needs a real terminal and a y: no TTY or a no changes nothing', async () => {
    const root = await inited('a2');
    const before = await fs.readFile(approvedFile(), 'utf8');
    await expect(allowCommand({ rule: 'Bash(npm run lint:*)', root }, io({ tty: false }))).rejects.toThrow(/terminal/);
    await expect(allowCommand({ rule: 'Bash(npm run lint:*)', root }, io({ answer: false }))).rejects.toThrow(/not added/i);
    expect(await fs.readFile(approvedFile(), 'utf8')).toBe(before);
    expect((await readJson(path.join(root, '.claude', 'settings.json'))).permissions.allow).not.toContain('Bash(npm run lint:*)');
  });

  it.each(['Bash(git push:*)', 'Bash(git:*)', 'Bash(GIT.exe push:*)'])('refuses %s as blocked by policy, even when confirmed', async (rule) => {
    const root = await inited('a3');
    const i = io({ answer: true });
    await expect(allowCommand({ rule, root }, i)).rejects.toThrow(/blocked by policy/);
    expect(i.asked).toEqual([]);
    expect((await readJson(approvedFile()))[projectId(root)].allow).not.toContain(rule);
    expect((await readJson(path.join(root, '.claude', 'settings.json'))).permissions.allow).not.toContain(rule);
  });

  it('refuses invalid rules and projects that were never approved', async () => {
    const root = await inited('a4');
    await expect(allowCommand({ rule: 'Bash(*)', root }, io())).rejects.toThrow(/valid/i);
    const other = await project('a5');
    await expect(allowCommand({ rule: 'Bash(npm run lint:*)', root: other }, io())).rejects.toThrow(/specboard init/);
  });
});

describe('sample project', () => {
  it('init --yes works on a copy of the sample', async () => {
    const root = path.join(tmp, 'sample');
    await fs.cp(SAMPLE, root, { recursive: true });
    expect((await init(root)).approved).toBe(true);
  });
});

describe('cli', () => {
  const cli = path.resolve(import.meta.dirname, '../src/cli.ts');
  const run = (args: string[]) =>
    spawnSync(process.execPath, ['--import', 'tsx', cli, ...args], {
      env: { ...process.env, SPECBOARD_HOME: home, INIT_CWD: tmp },
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      timeout: 60000,
    });

  it('parses init and allow arguments', () => {
    process.env.INIT_CWD = tmp;
    try {
      expect(parseInitArgs(['p', '--yes', '--force-skills'])).toEqual({ path: path.join(tmp, 'p'), yes: true, forceSkills: true });
      expect(() => parseInitArgs(['--nope'])).toThrow(/Unknown option/);
      expect(parseAllowArgs(['Bash(npm test:*)', 'p'])).toEqual({ rule: 'Bash(npm test:*)', path: path.join(tmp, 'p') });
      expect(() => parseAllowArgs(['Bash(npm test:*)', '--yes'])).toThrow(/no --yes/);
      expect(() => parseAllowArgs([])).toThrow(/Usage/);
    } finally {
      delete process.env.INIT_CWD;
    }
  });

  it('init without a terminal and without --yes refuses (exit 1)', async () => {
    const root = await project('c1');
    const r = run(['init', root]);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/--yes/);
    expect(await fs.readdir(root)).toEqual([]);
  });

  it('init --yes works, and allow without a terminal refuses (exit 1)', async () => {
    const root = await project('c2');
    expect(run(['init', root, '--yes']).status).toBe(0);
    const r = run(['allow', 'Bash(npm run lint:*)', root]);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/terminal/);
    expect((await readJson(approvedFile()))[projectId(root)].allow).not.toContain('Bash(npm run lint:*)');
  });
});
