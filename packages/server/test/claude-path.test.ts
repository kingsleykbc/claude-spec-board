import { spawnSync } from 'node:child_process';
import nodeFs from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { commandLauncher, RunManager, type RunEvent, type RunSnapshot } from '../src/claude/runs.js';
import { runRoutes } from '../src/routes/runs.js';
import { resolveCommand } from '../src/claude/resolve.js';
import { childEnv, claudeStatus, commandRunner, makeClaudeStatus, registeredRoots, type ClaudeStatus } from '../src/claude/status.js';
import { projectId, Registry, RegistryUnreadableError, type ProjectEntry } from '../src/registry.js';
import { realPathLoose } from '../src/safePath.js';
import { ApprovedPermissions, initCommand, type SetupIO } from '../src/setup.js';

// SAFETY: nothing here may ever start the real CLI. Everything that spawns uses a made-up command name and an explicit
// PATH over temp folders. The one test of the default `claude` lookup points PATH only at a temp folder.
vi.setConfig({ testTimeout: 40000 });

const WIN = process.platform === 'win32';
const D = path.delimiter;
const FAKE_NAME = 'zz-specboard-made-up-cli';
const TOOL = 'zz-specboard-made-up-tool';
const NO_CWD_VAR = 'NoDefaultCurrentDirectoryInExePath';
const PATHEXT = '.CMD';
const OK_STATUS: ClaudeStatus = { installed: true, loggedIn: true, version: '1.0.0' };
const DOWN: ClaudeStatus = { installed: false, loggedIn: false, version: null };

const SPEC = `---
id: T-001
title: Demo
status: todo
urgency: normal
categories: []
depends_on: []
draft: false
current_subtask: null
created: 2026-11-09
updated: 2026-11-09
---

## Spec
A demo.

## Subtasks
- [ ] 1. First
`;

let tmp: string;
let root: string;
let bin: string;
let warned: MockInstance<typeof console.warn>;

const exists = (f: string): Promise<boolean> => fs.access(f).then(() => true, () => false);
const noRoots = async (): Promise<string[]> => [];
const unsetNoCwdVar = (): void => {
  vi.stubEnv(NO_CWD_VAR, undefined as unknown as string); // a Claude session may set it, which would hide the bug
};
/** A harmless `.cmd` that records it ran by creating `marker`. */
const markerCmd = (marker: string): string => `@echo off\r\necho ran> "${marker}"\r\n`;
/** A `.cmd` that records it ran, then prints a version as the CLI would. */
const versionCmd = (marker: string, version: string): string => `@echo off\r\necho ran> "${marker}"\r\necho ${version}\r\n`;
/** The 8.3 spelling of an existing path. The same as the input where the volume has 8.3 names turned off. */
const shortName = (p: string): string =>
  spawnSync('cmd.exe', ['/d', '/s', '/c', `"for %I in ("${p}") do @echo %~sI"`], { windowsVerbatimArguments: true, encoding: 'utf8' }).stdout.trim();

beforeEach(async () => {
  tmp = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'sb-path-')));
  root = path.join(tmp, 'repo');
  bin = path.join(tmp, 'safe bin (x86)');
  await fs.mkdir(root);
  await fs.mkdir(bin);
  warned = vi.spyOn(console, 'warn').mockImplementation(() => undefined); // dropped PATH entries are reported this way
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await fs.rm(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

describe.runIf(WIN)('the status check and registered projects', () => {
  let scripts: string;
  let planted: string;
  let safe: string;

  beforeEach(async () => {
    unsetNoCwdVar();
    scripts = path.join(root, '.venv', 'Scripts'); // an activated virtual environment puts this on PATH
    planted = path.join(tmp, 'planted-ran');
    safe = path.join(tmp, 'safe-ran');
    await fs.mkdir(scripts, { recursive: true });
    await fs.writeFile(path.join(scripts, `${FAKE_NAME}.cmd`), versionCmd(planted, '6.6.6'));
  });

  it('reproduction: does not run a .cmd in a PATH folder inside a registered project, and says not found', async () => {
    expect(process.env[NO_CWD_VAR]).toBeUndefined();
    await expect(commandRunner(FAKE_NAME, { PATH: scripts, PATHEXT }, async () => [root])(['--version'])).rejects.toThrow(/not found/);
    expect(await exists(planted)).toBe(false);
    // The control: the same call with nothing registered does run it, so the assertion above means something.
    expect((await commandRunner(FAKE_NAME, { PATH: scripts, PATHEXT }, noRoots)(['--version'])).stdout).toContain('6.6.6');
    expect(await exists(planted)).toBe(true);
  });

  it('skips every registered project, and takes the program outside them', async () => {
    const other = path.join(tmp, 'other');
    await fs.mkdir(other);
    await fs.writeFile(path.join(other, `${FAKE_NAME}.cmd`), versionCmd(planted, '6.6.6'));
    await fs.writeFile(path.join(bin, `${FAKE_NAME}.cmd`), versionCmd(safe, '1.2.3'));
    const run = commandRunner(FAKE_NAME, { PATH: [other, scripts, bin].join(D), PATHEXT }, async () => [root, other]);
    expect((await run(['--version'])).stdout).toContain('1.2.3');
    expect(await exists(planted)).toBe(false);
  });

  it('a project registered after the cache was filled cannot reach it: the next check leaves it out', async () => {
    const file = path.join(tmp, 'home', 'projects.json');
    const roots = () => new Registry(file).roots();
    await fs.writeFile(path.join(bin, `${FAKE_NAME}.cmd`), versionCmd(safe, '1.2.3'));
    const status = makeClaudeStatus(commandRunner(FAKE_NAME, { PATH: [scripts, bin].join(D), PATHEXT }, roots), () => 1000, roots);
    expect((await status()).version).toBe('6.6.6'); // not registered yet, so nothing marks it as a project
    await fs.rm(planted);
    await new Registry(file).add(root); // a separate Registry: `init` and a second `start` write from another process
    expect((await status()).version).toBe('1.2.3');
    expect(await exists(planted)).toBe(false);
    await fs.rm(safe);
    expect((await status()).version).toBe('1.2.3'); // the new answer is cached under the new set
    expect(await exists(safe)).toBe(false);
  });

  it('a real CLI only inside a project reads as not installed', async () => {
    const roots = async () => [root];
    const status = makeClaudeStatus(commandRunner(FAKE_NAME, { PATH: scripts, PATHEXT }, roots), () => 1000, roots);
    expect(await status()).toEqual({ ...DOWN, blockedBy: path.join(scripts, `${FAKE_NAME}.cmd`) });
    expect(await exists(planted)).toBe(false);
  });

  it('a shim that fails with entries dropped names the first of them; with none dropped it says nothing extra', async () => {
    await fs.writeFile(path.join(bin, `${FAKE_NAME}.cmd`), '@echo off\r\nexit /b 9\r\n');
    const roots = async () => [root];
    const dropped = makeClaudeStatus(commandRunner(FAKE_NAME, { PATH: [scripts, bin].join(D), PATHEXT }, roots), () => 1000, roots);
    expect(await dropped()).toEqual({ ...DOWN, blockedBy: scripts });
    expect(await exists(planted)).toBe(false);
    const clean = makeClaudeStatus(commandRunner(FAKE_NAME, { PATH: bin, PATHEXT }, roots), () => 1000, roots);
    expect(await clean()).toEqual(DOWN);
  });

  it('warns about each dropped entry and its project once per root set, and again when the set changes', async () => {
    const other = path.join(tmp, 'other');
    await fs.mkdir(other);
    await fs.writeFile(path.join(bin, `${FAKE_NAME}.cmd`), versionCmd(safe, '1.2.3'));
    let registered = [root];
    const run = commandRunner(FAKE_NAME, { PATH: [scripts, bin].join(D), PATHEXT }, async () => registered);
    await run(['--version']);
    await run(['--version']);
    expect(warned).toHaveBeenCalledTimes(1);
    expect(warned.mock.calls[0]![0]).toContain(scripts);
    expect(warned.mock.calls[0]![0]).toContain(root);
    registered = [root, other];
    await run(['--version']);
    expect(warned).toHaveBeenCalledTimes(2);
    await commandRunner(FAKE_NAME, { PATH: bin, PATHEXT }, async () => [bin + '-none'])(['--version']);
    expect(warned).toHaveBeenCalledTimes(2); // nothing dropped, nothing to say
  });

  it('warns if git or node are only in dropped folders, and never starts them', async () => {
    const gitRan = path.join(tmp, 'git-ran');
    const nodeRan = path.join(tmp, 'node-ran');
    await fs.writeFile(path.join(scripts, 'git.cmd'), markerCmd(gitRan));
    await fs.writeFile(path.join(scripts, 'node.cmd'), markerCmd(nodeRan));
    await fs.writeFile(path.join(bin, 'node.cmd'), ''); // node also exists outside, so only git is missing
    await fs.writeFile(path.join(bin, `${FAKE_NAME}.cmd`), versionCmd(safe, '1.2.3'));
    await commandRunner(FAKE_NAME, { PATH: [scripts, bin].join(D), PATHEXT }, async () => [root])(['--version']);
    const said = warned.mock.calls.map((c) => String(c[0]));
    expect(said.filter((t) => t.startsWith('git '))).toHaveLength(1);
    expect(said.find((t) => t.startsWith('git '))).toContain(path.join(scripts, 'git.cmd'));
    expect(said.some((t) => t.startsWith('node '))).toBe(false);
    expect(await exists(gitRan)).toBe(false);
    expect(await exists(nodeRan)).toBe(false);
  });

  it('fails safe when the registered set cannot be read: not installed, and nothing starts', async () => {
    const home = path.join(tmp, 'home');
    await fs.mkdir(home);
    await fs.writeFile(path.join(home, 'projects.json'), 'not json');
    vi.stubEnv('SPECBOARD_HOME', home);
    await expect(registeredRoots()).rejects.toThrow(/projects\.json/);
    const inner = commandRunner(FAKE_NAME, { PATH: scripts, PATHEXT }, registeredRoots);
    const run = vi.fn(inner);
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await makeClaudeStatus(run, () => 1000, registeredRoots)()).toEqual(DOWN);
    expect(run).not.toHaveBeenCalled();
    expect(logged.mock.calls[0]![0]).toMatch(/Cannot read the project list.*projects\.json/);
    await expect(inner(['--version'])).rejects.toThrow(/projects\.json/);
    expect(await exists(planted)).toBe(false);
  });

  it('the default check reads the registry under SPECBOARD_HOME, and skips what it lists', async () => {
    // Named `claude`, but PATH holds only this temp folder, so all it could ever start is this harmless file.
    await fs.writeFile(path.join(scripts, 'claude.cmd'), versionCmd(planted, '6.6.6'));
    const home = path.join(tmp, 'home');
    await new Registry(path.join(home, 'projects.json')).add(root);
    vi.stubEnv('SPECBOARD_HOME', home);
    vi.stubEnv('PATH', scripts);
    vi.stubEnv('PATHEXT', PATHEXT);
    expect(await registeredRoots()).toEqual([root]);
    expect(await claudeStatus()).toEqual({ ...DOWN, blockedBy: path.join(scripts, 'claude.cmd') });
    expect(await exists(planted)).toBe(false);
  });
});

describe.runIf(WIN)('other spellings of a project folder', () => {
  let project: string;
  let inner: string;

  beforeEach(async () => {
    project = path.join(root, 'A Long Project Folder Name');
    inner = path.join(project, 'A Long Inner Folder Name');
    await fs.mkdir(inner, { recursive: true });
    await fs.writeFile(path.join(inner, `${FAKE_NAME}.cmd`), '');
  });

  it('the control: outside the exclusion these spellings do find the file', ({ skip }) => {
    const found = path.join(`\\\\?\\${inner}`, `${FAKE_NAME}.cmd`);
    expect(resolveCommand(FAKE_NAME, { PATH: `\\\\?\\${inner}`, PATHEXT })).toBe(found);
    const short = shortName(inner);
    if (short === inner) skip('this volume has no 8.3 names');
    expect(resolveCommand(FAKE_NAME, { PATH: short, PATHEXT })).toBe(path.join(short, `${FAKE_NAME}.cmd`));
  });

  it('catches a \\\\?\\ PATH entry and a \\\\?\\ exclusion', () => {
    expect(resolveCommand(FAKE_NAME, { PATH: `\\\\?\\${inner}`, PATHEXT, exclude: [project] })).toBeNull();
    expect(resolveCommand(FAKE_NAME, { PATH: inner, PATHEXT, exclude: [`\\\\?\\${project}`] })).toBeNull();
    expect(resolveCommand(FAKE_NAME, { PATH: `\\\\.\\${inner}`, PATHEXT, exclude: [project] })).toBeNull();
  });

  it('falls back to the plain lookup on a volume that refuses the system one, and copes with a missing folder', () => {
    const native = vi.spyOn(nodeFs.realpathSync, 'native').mockImplementation(() => {
      throw new Error('EISDIR');
    });
    expect(realPathLoose(project)).toBe(project);
    expect(resolveCommand(FAKE_NAME, { PATH: inner, PATHEXT, exclude: [project] })).toBeNull();
    expect(native).toHaveBeenCalled();
    native.mockRestore();
    expect(realPathLoose(path.join(project, 'not', 'there'))).toBe(path.join(project, 'not', 'there'));
    expect(resolveCommand(FAKE_NAME, { PATH: path.join(project, 'not', 'there'), PATHEXT, exclude: [project] })).toBeNull();
  });

  it('catches an 8.3 PATH entry and an 8.3 exclusion', ({ skip }) => {
    const shortInner = shortName(inner);
    const shortProject = shortName(project);
    if (shortInner === inner || shortProject === project) skip('this volume has no 8.3 names');
    expect(resolveCommand(FAKE_NAME, { PATH: shortInner, PATHEXT, exclude: [project] })).toBeNull();
    expect(resolveCommand(FAKE_NAME, { PATH: inner, PATHEXT, exclude: [shortProject] })).toBeNull();
    expect(childEnv([project], { PATH: `${shortInner};${bin}` }).PATH).toBe(bin);
  });

  it('catches a dotted way back in and a trailing dot', () => {
    const dotted = `${bin}\\..\\repo\\A Long Project Folder Name\\.\\A Long Inner Folder Name`;
    expect(resolveCommand(FAKE_NAME, { PATH: dotted, PATHEXT, exclude: [project] })).toBeNull();
    expect(resolveCommand(FAKE_NAME, { PATH: `${inner}.`, PATHEXT, exclude: [project] })).toBeNull();
  });

  it('a home inside the project is seen through those spellings, by the approved list and by init', async () => {
    const spellings = [`\\\\?\\${project}`, shortName(project)];
    const io: SetupIO = { isTTY: true, confirm: async () => true, log: () => undefined };
    const home = path.join(project, 'home');
    vi.stubEnv('SPECBOARD_HOME', home);
    for (const spelling of spellings) {
      await expect(new ApprovedPermissions(path.join(home, 'permissions.json')).get(projectId(project), spelling)).resolves.toBeNull();
      await expect(new ApprovedPermissions(path.join(spelling, 'home', 'permissions.json')).get(projectId(project), project)).resolves.toBeNull();
      await expect(initCommand({ root: spelling, yes: true, forceSkills: false, kitDir: path.join(tmp, 'no-kit') }, io)).rejects.toThrow(/inside this folder/);
    }
  });
});

describe('the child PATH', () => {
  it('drops empty, relative and dot entries and those inside the project, and keeps the order', () => {
    const later = path.join(tmp, 'later');
    const inner = path.join(root, 'bin');
    const value = ['', later, '.', inner, '..', bin, '.\\bin', './bin', root, 'bin', '  '].join(D);
    expect(childEnv([root], { PATH: value }).PATH).toBe([later, bin].join(D));
  });

  it('keeps an entry as it was written, quotes included', () => {
    const quoted = `"${bin}"`;
    expect(childEnv([root], { PATH: `${quoted}${D}${root}` }).PATH).toBe(quoted);
  });

  it('leaves everything else alone, and adds no PATH where there was none', () => {
    const env = childEnv([root], { SOME_VAR: 'x' });
    expect(env.SOME_VAR).toBe('x');
    expect(Object.keys(env).filter((k) => k.toUpperCase() === 'PATH')).toEqual([]);
  });

  it('reads this process by default', () => {
    vi.stubEnv('PATH', `.${D}${root}${D}${bin}`);
    expect(childEnv([root]).PATH ?? childEnv([root]).Path).toBe(bin);
  });

  it.runIf(WIN)('keeps the key as it is spelled, and never produces two', () => {
    const inner = path.join(root, 'bin');
    const one = childEnv([root], { Path: `${inner};${bin}` });
    expect(Object.keys(one).filter((k) => k.toUpperCase() === 'PATH')).toEqual(['Path']);
    expect(one.Path).toBe(bin);
    // Node starts a child with the first of these in sorted order, so that is the value that counts.
    const two = childEnv([root], { Path: path.join(tmp, 'later'), PATH: `${inner};${bin}` });
    expect(Object.keys(two).filter((k) => k.toUpperCase() === 'PATH')).toEqual(['PATH']);
    expect(two.PATH).toBe(bin);
    const lower = childEnv([root], { path: `.;${bin}` });
    expect(Object.keys(lower).filter((k) => k.toUpperCase() === 'PATH')).toEqual(['path']);
    expect(lower.path).toBe(bin);
  });

  it.runIf(WIN)('the lookup finds PATH and PATHEXT under whichever key exists', async () => {
    await fs.writeFile(path.join(bin, `${FAKE_NAME}.cmd`), '@echo off\r\necho 9.9.9\r\n');
    const env = { Path: bin, PathExt: PATHEXT };
    expect((await commandRunner(FAKE_NAME, env, noRoots)(['--version'])).stdout).toContain('9.9.9');
    expect(commandLauncher(FAKE_NAME, env)(['-p'], [root]).bin).toBe(path.join(bin, `${FAKE_NAME}.cmd`));
  });

  describe.runIf(WIN)('a shim calling a bare command', () => {
    let ran: Record<'venv' | 'relative' | 'cwd' | 'first' | 'second', string>;

    beforeEach(async () => {
      unsetNoCwdVar();
      const venv = path.join(root, '.venv', 'Scripts');
      const relative = path.join(tmp, 'relative');
      const first = path.join(tmp, 'first');
      const second = path.join(tmp, 'second');
      await fs.mkdir(venv, { recursive: true });
      for (const d of [relative, first, second]) await fs.mkdir(d);
      ran = {
        venv: path.join(tmp, 'venv-ran'),
        relative: path.join(tmp, 'relative-ran'),
        cwd: path.join(tmp, 'cwd-ran'),
        first: path.join(tmp, 'first-ran'),
        second: path.join(tmp, 'second-ran'),
      };
      await fs.writeFile(path.join(venv, `${TOOL}.cmd`), markerCmd(ran.venv));
      await fs.writeFile(path.join(relative, `${TOOL}.cmd`), markerCmd(ran.relative));
      await fs.writeFile(path.join(root, `${TOOL}.cmd`), markerCmd(ran.cwd));
      await fs.writeFile(path.join(first, `${TOOL}.cmd`), markerCmd(ran.first));
      await fs.writeFile(path.join(second, `${TOOL}.cmd`), markerCmd(ran.second));
      await fs.writeFile(path.join(bin, `${FAKE_NAME}.cmd`), `@echo off\r\ncall ${TOOL}\r\necho 1.0.0\r\n`); // like npm's shim calling node
      vi.stubEnv('PATH', [venv, path.relative(process.cwd(), relative), first, second].join(D));
    });

    const expectOnlyFirstRan = async (): Promise<void> => {
      expect(await exists(ran.first)).toBe(true);
      expect(await exists(ran.venv)).toBe(false);
      expect(await exists(ran.relative)).toBe(false);
      expect(await exists(ran.cwd)).toBe(false);
      expect(await exists(ran.second)).toBe(false);
    };

    it('from the status check, started in a folder holding the planted file, runs in the temp folder and cannot reach it', async () => {
      const seenCwd = path.join(tmp, 'status-cwd');
      // `.\\` reaches the current folder whatever the search variable says, so only pinning the folder keeps this out.
      await fs.writeFile(path.join(bin, `${FAKE_NAME}.cmd`), `@echo off\r\necho %CD%> "${seenCwd}"\r\ncall .\\${TOOL}\r\ncall ${TOOL}\r\necho 1.0.0\r\n`);
      // Relative to where the child now runs, so this entry would really work if it were kept.
      const venv = path.join(root, '.venv', 'Scripts');
      const relative = path.relative(await fs.realpath(os.tmpdir()), path.join(tmp, 'relative'));
      vi.stubEnv('PATH', [venv, relative, path.join(tmp, 'first'), path.join(tmp, 'second')].join(D));
      const before = process.cwd();
      process.chdir(root);
      try {
        expect(await exists(path.join(process.cwd(), `${TOOL}.cmd`))).toBe(true);
        await commandRunner(FAKE_NAME, { PATH: bin, PATHEXT }, async () => [root])(['--version']);
      } finally {
        process.chdir(before);
      }
      await expectOnlyFirstRan();
      expect(await fs.realpath((await fs.readFile(seenCwd, 'utf8')).trim())).toBe(await fs.realpath(os.tmpdir()));
    });

    it('from a run, cannot reach the project, a relative entry, or a command in its own folder', async () => {
      const dir = path.join(root, '.specboard', 'specs', 'T-001-demo');
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, 'spec.md'), SPEC);
      const entry = { id: projectId(root), root, name: 'repo' } as ProjectEntry;
      const approved = new ApprovedPermissions(path.join(tmp, 'home', 'permissions.json'));
      await approved.set(entry.id, root, { allow: ['Read(./**)'], deny: [] });
      await new Promise<RunSnapshot>((resolve) => {
        const m = new RunManager({
          approved,
          status: async () => OK_STATUS,
          roots: noRoots, // its own root is left out whatever the registry says
          command: commandLauncher(FAKE_NAME, { PATH: bin, PATHEXT }),
          emit: (_pid, e: RunEvent) => {
            if (e.type === 'run-ended') resolve(e.run);
          },
        });
        void m.start(entry, 'run', 'T-001');
      });
      await expectOnlyFirstRan();
    });
  });
});

describe.runIf(WIN)('a run and the other registered projects', () => {
  let entry: ProjectEntry;
  let approved: ApprovedPermissions;
  let other: string;
  let otherScripts: string;
  let plantedRan: string;
  let safeRan: string;

  beforeEach(async () => {
    unsetNoCwdVar();
    const dir = path.join(root, '.specboard', 'specs', 'T-001-demo');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'spec.md'), SPEC);
    entry = { id: projectId(root), root, name: 'repo' } as ProjectEntry;
    approved = new ApprovedPermissions(path.join(tmp, 'home', 'permissions.json'));
    await approved.set(entry.id, root, { allow: ['Read(./**)'], deny: [] });

    other = path.join(tmp, 'project-b');
    otherScripts = path.join(other, '.venv', 'Scripts');
    plantedRan = path.join(tmp, 'b-ran');
    safeRan = path.join(tmp, 'safe-path-seen');
    await fs.mkdir(otherScripts, { recursive: true });
    // Named `claude`, but the lookup's PATH and the child's hold only temp folders, so these two files are all it can start.
    await fs.writeFile(path.join(otherScripts, 'claude.cmd'), markerCmd(plantedRan));
    await fs.writeFile(path.join(bin, 'claude.cmd'), `@echo off\r\necho %PATH%> "${safeRan}"\r\n`);
    vi.stubEnv('PATH', [otherScripts, bin].join(D));
  });

  const runInA = (roots: () => Promise<string[]>): Promise<RunSnapshot> =>
    new Promise((resolve) => {
      const m = new RunManager({
        approved,
        roots,
        status: async () => OK_STATUS,
        command: commandLauncher('claude', { PATH: [otherScripts, bin].join(D), PATHEXT }),
        emit: (_pid, e: RunEvent) => {
          if (e.type === 'run-ended') resolve(e.run);
        },
      });
      void m.start(entry, 'run', 'T-001');
    });

  it("does not start project B's claude.cmd, and B's folder is not on the child's PATH", async () => {
    const file = path.join(tmp, 'home', 'projects.json');
    await new Registry(file).add(other);
    await runInA(() => new Registry(file).roots());
    expect(await exists(plantedRan)).toBe(false);
    const seen = (await fs.readFile(safeRan, 'utf8')).trim();
    expect(seen).toBe(bin);
  });

  it('the control: with B not registered, its program is what starts', async () => {
    await runInA(noRoots);
    expect(await exists(plantedRan)).toBe(true);
    expect(await exists(safeRan)).toBe(false);
  });

  it('a refused run names what blocked it, on the error and in the response', async () => {
    const blockedBy = path.join(otherScripts, 'claude.cmd');
    const m = new RunManager({
      approved,
      roots: noRoots,
      status: async () => ({ ...DOWN, blockedBy }),
      command: commandLauncher('claude', { PATH: bin, PATHEXT }),
      emit: () => undefined,
    });
    const app = runRoutes({ registry: { get: async () => entry } as unknown as Registry, runs: m, approved, status: async () => DOWN });
    const res = await app.request(`/api/projects/${entry.id}/runs`, { method: 'POST', body: JSON.stringify({ kind: 'run', specId: 'T-001' }), headers: { 'content-type': 'application/json' } });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      error: `Claude Code is inside a registered project (${blockedBy}), so runs won't use it.`,
      claude: 'not-installed',
      blockedBy,
    });
    expect(await exists(safeRan)).toBe(false);
  });

  it('an unreadable registry stops the run and says so, not "not installed", and starts nothing', async () => {
    const roots = async (): Promise<string[]> => {
      throw new RegistryUnreadableError('projects.json');
    };
    const events: RunEvent[] = [];
    const m = new RunManager({
      approved,
      roots,
      status: async () => DOWN,
      command: commandLauncher('claude', { PATH: bin, PATHEXT }),
      emit: (_pid, e) => events.push(e),
    });
    const refused = expect(m.start(entry, 'run', 'T-001')).rejects;
    await refused.toBeInstanceOf(RegistryUnreadableError);
    await refused.toThrow(/Cannot read the project list.*projects\.json/);
    expect(events).toEqual([]);
    expect(await exists(safeRan)).toBe(false);

    const app = runRoutes({ registry: { get: async () => entry } as unknown as Registry, runs: m, approved, status: async () => DOWN });
    const res = await app.request(`/api/projects/${entry.id}/runs`, { method: 'POST', body: JSON.stringify({ kind: 'run', specId: 'T-001' }), headers: { 'content-type': 'application/json' } });
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: string; claude?: string };
    expect(body.error).toMatch(/Cannot read the project list/);
    expect(body.claude).toBeUndefined();
  });
});

describe.skipIf(WIN)('the child PATH elsewhere', () => {
  it('uses the exact key, as case matters here', () => {
    const env = childEnv([root], { PATH: `.:${root}:${bin}`, Path: '.' });
    expect(env.PATH).toBe(bin);
    expect(env.Path).toBe('.');
  });
});
