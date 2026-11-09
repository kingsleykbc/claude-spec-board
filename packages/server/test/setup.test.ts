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
  InvalidApprovalError,
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
    'Bash(bash:*)', 'Bash(sh -c:*)', 'Bash(env:*)', 'PowerShell(pwsh:*)', 'Bash(git -C . push:*)', 'Bash(/usr/bin/git push:*)',
    'Bash(\\git push:*)', 'Bash("git" push:*)', 'Bash(rm -fr:*)', 'Bash(rm -rf:*)', 'Bash(rm:*)', 'Bash(g*)', 'Bash(git p*)',
    'Read(~/**)', 'Write(~/**)', 'Edit(../**)', 'Write(./../**)', 'Write(C:/**)', 'Write(//c/**)', 'Edit(/**/*)', 'Read(/*)',
    'Write(./a/../../x)', 'Write(.\\x)', 'NotebookEdit', 'MultiEdit', 'MultiEdit(/x)', 'bash(*)', 'BASH', 'bash(npm test:*)',
    'Bash(a) Bash(*)', 'Bash(a)(b)', 'Bash(\u200b*)', 'Bash(npm\u200b test:*)', 'Bash(npm  test:*)', 'Bash(npm test: *)',
    'Read(./a) Bash(*)', 'Write(./a),Bash(*)', 'Edit(./a)(b)', 'Read(./a) Write(/etc/x)', 'Read(./a', 'Read(./a,./b)', 'Read(./a)) x',
    'PowerShell(iex:*)', 'PowerShell(Invoke-Expression:*)', 'PowerShell(Start-Process:*)', 'PowerShell(Remove-Item:*)',
    'PowerShell(ri:*)', 'PowerShell(del:*)', 'PowerShell(icm:*)', 'PowerShell(rmdir:*)', 'Bash(bash.:*)', 'Bash(rm.:*)', 'Bash(RM.exe:*)',
    'Bash(npm test:*) ', ' Bash(npm test:*)', 'Bash(git push:*)\u0000', 'glob', 'Task(x)', 'WebFetch(x)', 'mcp__a b',
    // cmd.exe metacharacters, which a .cmd shim would act on
    'Read(./x&echo pwned>marker.txt&/**)', 'Read(./R&D/**)', 'Edit(./a|b)', 'Write(./a<b)', 'Write(./a>b)', 'Read(./a^b)', 'Read(./%PATH%/**)',
    'Read(./a"b)', 'Read(./a!b)', 'Read(./a`b)', 'Bash(npm%x:*)', 'Bash(npm test!:*)', 'PowerShell(npm^test:*)', 'WebFetch(domain:a&b)', 'mcp__a&b', 'Foo&Bar',
  ])('rejects %j', (r) => expect(isValidRule(r)).toBe(false));
  it.each([
    'Bash(npm test:*)', 'Bash(npm run lint:*)', 'Bash(git push:*)', 'Bash(git:*)', 'Read(./**)', 'Read(./app/(group)/**)', 'Edit(./src/**)', 'Glob', 'Grep',
    'WebFetch', 'WebFetch(domain:example.com)', 'PowerShell(npm test:*)', 'mcp__srv__tool',
  ])('accepts %s', (r) => expect(isValidRule(r)).toBe(true));
  it('refuses a flag as the first argument word, but allows interpreters a person types', () => {
    expect(isValidRule('Bash(npm --version)')).toBe(false);
    expect(isValidRule('Bash(python3 -m:*)')).toBe(false);
    for (const r of ['Bash(node:*)', 'Bash(python3:*)', 'Bash(python:*)', 'Bash(ruby:*)', 'Bash(perl:*)', 'Bash(php:*)', 'Bash(deno:*)', 'Bash(bun:*)']) {
      expect(isValidRule(r)).toBe(true);
    }
  });
});

describe('defaultAllowList', () => {
  it('has no git push allow, and detects npm test only when the script exists', async () => {
    const a = await defaultAllowList(await project('a'));
    expect(a.allow.some((r) => r.includes('git push'))).toBe(false);
    expect(a.allow).not.toContain('Glob');
    expect(a.allow).not.toContain('Grep');
    expect(a.deny).toEqual(
      expect.arrayContaining([
        'Bash(git push:*)', 'Bash(git reset:*)', 'Bash(rm -rf:*)', 'PowerShell(git push:*)', 'PowerShell(git reset:*)',
        'Edit(./.claude/**)', 'Write(./.claude/**)', 'Edit(./.git/**)', 'Write(./.git/**)',
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
    await expect(new ApprovedPermissions(approvedFile()).set('abcd1234', tmp, p)).resolves.toBeUndefined();
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
    expect(await s.get('aaaaaaaa', tmp)).toBeNull();
    await s.set('aaaaaaaa', tmp, p);
    await s.set('bbbbbbbb', tmp, { allow: ['Glob'], deny: [] });
    expect(await s.get('aaaaaaaa', tmp)).toEqual(p);
    expect(await s.get('bbbbbbbb', tmp)).toEqual({ allow: ['Glob'], deny: [] });
  });
  describe('a stored entry that fails the rule checks', () => {
    const edit = async (id: string, change: (e: { allow: string[]; deny: string[] }) => void) => {
      const all = await readJson(approvedFile());
      change(all[id]);
      await fs.writeFile(approvedFile(), JSON.stringify(all));
    };
    it.each([
      ['a hand-edited Bash(*)', (e: { allow: string[] }) => e.allow.push('Bash(*)')],
      ['a metacharacter in an allow rule', (e: { allow: string[] }) => e.allow.push('Read(./R&D/**)')],
      ['a metacharacter in a deny rule', (e: { deny: string[] }) => e.deny.push('Read(./x&calc&)')],
      ['an allow rule that meets the deny list', (e: { allow: string[] }) => e.allow.push('Bash(git push origin:*)')],
    ])('%s is an error that names init, not an approval', async (_name, change) => {
      const s = new ApprovedPermissions(approvedFile());
      await s.set('aaaaaaaa', tmp, p);
      await edit('aaaaaaaa', change as (e: { allow: string[]; deny: string[] }) => void);
      const err = await s.get('aaaaaaaa', tmp).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(InvalidApprovalError);
      expect((err as Error).message).toMatch(/specboard init/);
    });
    it('does not affect other projects', async () => {
      const s = new ApprovedPermissions(approvedFile());
      await s.set('aaaaaaaa', tmp, p);
      await s.set('bbbbbbbb', tmp, p);
      await edit('aaaaaaaa', (e) => e.allow.push('Bash(*)'));
      expect(await s.get('bbbbbbbb', tmp)).toEqual(p);
    });
    it('the default deny list is accepted, though rm is refused as an allow rule', async () => {
      const s = new ApprovedPermissions(approvedFile());
      await s.set('aaaaaaaa', tmp, { allow: ['Read(./**)'], deny: ['Bash(rm -rf:*)'] });
      expect(await s.get('aaaaaaaa', tmp)).toEqual({ allow: ['Read(./**)'], deny: ['Bash(rm -rf:*)'] });
    });
    it('set refuses a metacharacter in a deny rule', async () => {
      const s = new ApprovedPermissions(approvedFile());
      await expect(s.set('aaaaaaaa', tmp, { allow: [], deny: ['Read(./x&calc&)'] })).rejects.toThrow(/valid/i);
    });
  });
  it('addAllow adds once, and needs an existing entry', async () => {
    const s = new ApprovedPermissions(approvedFile());
    await expect(s.addAllow('aaaaaaaa', tmp, 'Bash(npm test:*)')).rejects.toThrow(/not approved|init/i);
    await s.set('aaaaaaaa', tmp, p);
    await s.addAllow('aaaaaaaa', tmp, 'Bash(npm test:*)');
    await s.addAllow('aaaaaaaa', tmp, 'Bash(npm test:*)');
    expect((await s.get('aaaaaaaa', tmp))!.allow).toEqual([...p.allow, 'Bash(npm test:*)']);
  });
  it.each(['Bash(git push:*)', 'Bash(git:*)', 'Bash(GIT.exe push:*)', 'PowerShell(git push origin:*)', 'Write(./.claude/**)'])(
    'addAllow refuses %s as blocked by policy',
    async (rule) => {
      const s = new ApprovedPermissions(approvedFile());
      await s.set('aaaaaaaa', tmp, { allow: ['Read(./**)'], deny: ['Bash(git push:*)', 'Write(./.claude/**)'] });
      await expect(s.addAllow('aaaaaaaa', tmp, rule)).rejects.toThrow(/blocked by policy/);
      expect((await s.get('aaaaaaaa', tmp))!.allow).toEqual(['Read(./**)']);
    },
  );
  it('addAllow and set refuse invalid rules and rules that meet the deny list', async () => {
    const s = new ApprovedPermissions(approvedFile());
    await s.set('aaaaaaaa', tmp, p);
    await expect(s.addAllow('aaaaaaaa', tmp, 'Bash(*)')).rejects.toThrow(/valid/i);
    await expect(s.set('aaaaaaaa', tmp, { allow: ['Bash(*)'], deny: [] })).rejects.toThrow(/valid/i);
    await expect(s.set('aaaaaaaa', tmp, { allow: ['Bash(git push origin:*)'], deny: ['Bash(git push:*)'] })).rejects.toThrow(/blocked by policy/);
  });
  it('a malformed file is an error, never read as empty and never overwritten', async () => {
    await fs.mkdir(home, { recursive: true });
    for (const bad of ['{nope', '[]', '{"aaaaaaaa":{"allow":"x","deny":[]}}']) {
      await fs.writeFile(approvedFile(), bad);
      const s = new ApprovedPermissions(approvedFile());
      await expect(s.get('aaaaaaaa', tmp)).rejects.toThrow(/permissions\.json/);
      await expect(s.set('bbbbbbbb', tmp, p)).rejects.toThrow(/permissions\.json/);
      await expect(s.addAllow('aaaaaaaa', tmp, 'Glob')).rejects.toThrow(/permissions\.json/);
      expect(await fs.readFile(approvedFile(), 'utf8')).toBe(bad);
    }
  });
  it('get returns null, not an error, when the approved folder no longer exists', async () => {
    const gone = await project('gone');
    const s = new ApprovedPermissions(approvedFile());
    await s.set('aaaaaaaa', gone, p);
    await fs.rm(gone, { recursive: true });
    expect(await s.get('aaaaaaaa', gone)).toBeNull();
  });
  it('leaves no temp files behind', async () => {
    await new ApprovedPermissions(approvedFile()).set('aaaaaaaa', tmp, p);
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
    expect(approved[id]).toEqual({ ...settings.permissions, root: await fs.realpath(root) });
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
    await store.set(id, root, { allow: ['Read(./**)'], deny: ['Bash(git push:*)'] });
    await fs.mkdir(path.join(root, '.claude'));
    await fs.writeFile(path.join(root, '.claude', 'settings.json'), JSON.stringify({ permissions: { allow: ['Bash(*)'] } }));
    expect(await store.get(id, root)).toEqual({ allow: ['Read(./**)'], deny: ['Bash(git push:*)'] });
    await init(root);
    const got = (await store.get(id, root))!;
    expect(got.allow).not.toContain('Bash(*)');
    expect(got.allow).toContain('Read(./**)');
  });
});

describe('init: links, approval binding and the no answer', () => {
  it('refuses a linked .specboard and writes nothing outside the project', async () => {
    const root = await project('l1');
    const outside = path.join(tmp, 'outside-sb');
    await fs.mkdir(outside);
    await fs.symlink(outside, path.join(root, '.specboard'), 'junction');
    await expect(init(root)).rejects.toThrow(/link/);
    expect(await fs.readdir(outside)).toEqual([]);
    await expect(fs.stat(approvedFile())).rejects.toThrow();
  });
  it('refuses a linked .specboard/specs', async () => {
    const root = await project('l2');
    const outside = path.join(tmp, 'outside-specs');
    await fs.mkdir(outside);
    await fs.mkdir(path.join(root, '.specboard'));
    await fs.symlink(outside, path.join(root, '.specboard', 'specs'), 'junction');
    await expect(init(root)).rejects.toThrow(/link/);
    expect(await fs.readdir(outside)).toEqual([]);
  });
  it('an approval only counts for the folder it was given for', async () => {
    const root = await project('b1');
    await init(root);
    const id = projectId(root);
    const store = new ApprovedPermissions(approvedFile());
    expect(await store.get(id, root)).not.toBeNull();
    const elsewhere = await project('b2');
    expect(await store.get(id, elsewhere)).toBeNull();
    await expect(store.addAllow(id, elsewhere, 'Bash(npm run lint:*)')).rejects.toThrow(/not approved/);
    const link = path.join(tmp, 'link');
    await fs.symlink(root, link, 'junction');
    expect(await store.get(id, link)).not.toBeNull();
    await fs.rm(link, { recursive: true });
  });
  it('a retargeted folder reads as not approved and init asks again', async () => {
    const root = await project('b3');
    await init(root);
    const file = approvedFile();
    const all = await readJson(file);
    all[projectId(root)].root = path.join(tmp, 'somewhere-else');
    await fs.writeFile(file, JSON.stringify(all));
    const i = io({ answer: true });
    await initCommand({ root, yes: false, forceSkills: false }, i);
    expect(i.asked).toHaveLength(1);
    expect((await readJson(file))[projectId(root)].root).toBe(await fs.realpath(root));
  });
  it('no on an approved project says the approval is unchanged and how to revoke it', async () => {
    const root = await project('n1');
    await init(root);
    const before = await fs.readFile(approvedFile(), 'utf8');
    const i = io({ answer: false });
    const r = await initCommand({ root, yes: false, forceSkills: false }, i);
    expect(r.approved).toBe(false);
    const text = i.out.join('\n');
    expect(text).toContain('Existing approval is unchanged');
    expect(text).toContain('permissions.json');
    expect(text).not.toContain('runs are not approved');
    expect(await fs.readFile(approvedFile(), 'utf8')).toBe(before);
  });
  it('re-init repairs an entry a run refused, so the error message tells the truth', async () => {
    const root = await project('d2');
    await init(root);
    const id = projectId(root);
    const all = await readJson(approvedFile());
    all[id].allow.push('Read(./R&D/**)', 'Bash(*)');
    all[id].deny.push('Read(./x&calc&)');
    await fs.writeFile(approvedFile(), JSON.stringify(all));
    const store = new ApprovedPermissions(approvedFile());
    await expect(store.get(id, root)).rejects.toBeInstanceOf(InvalidApprovalError);

    const i = io();
    await expect(initCommand({ root, yes: true, forceSkills: false }, i)).resolves.toMatchObject({ approved: true });
    const out = i.out.join('\n');
    expect(out).toContain('Dropping earlier rule Read(./R&D/**)');
    expect(out).toContain('Dropping earlier deny rule Read(./x&calc&)');
    const fixed = (await store.get(id, root))!;
    expect(fixed.allow).not.toContain('Bash(*)');
    expect(fixed.deny).toContain('Bash(git push:*)');
  });
  it('re-init drops a stored rule that fails the current checks, with a notice', async () => {
    const root = await project('d1');
    await init(root);
    const all = await readJson(approvedFile());
    all[projectId(root)].allow.push('Bash(bash:*)');
    await fs.writeFile(approvedFile(), JSON.stringify(all));
    const i = io();
    await expect(initCommand({ root, yes: true, forceSkills: false }, i)).resolves.toMatchObject({ approved: true });
    expect(i.out.join('\n')).toContain('Dropping earlier rule Bash(bash:*)');
    expect((await readJson(approvedFile()))[projectId(root)].allow).not.toContain('Bash(bash:*)');
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
