import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { commandLauncher, ClaudeUnavailableError, RunManager, type RunEvent, type RunSnapshot } from '../src/claude/runs.js';
import { resolveCommand, taskkillPath } from '../src/claude/resolve.js';
import { childEnv, commandRunner, type ClaudeStatus } from '../src/claude/status.js';
import { projectId, type ProjectEntry } from '../src/registry.js';
import { ApprovedPermissions } from '../src/setup.js';

// SAFETY: nothing here may ever start the real CLI. Everything that spawns uses a made-up command name and an explicit
// PATH over temp folders, and the one test of the default `claude` lookup points PATH at an empty folder.
vi.setConfig({ testTimeout: 40000 });

const WIN = process.platform === 'win32';
const FAKE_NAME = 'zz-specboard-made-up-cli';
const NO_CWD_VAR = 'NoDefaultCurrentDirectoryInExePath';
const OK_STATUS: ClaudeStatus = { installed: true, loggedIn: true, version: '1.0.0' };

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

/** A harmless `.cmd` that records it ran by creating `marker`. */
const markerCmd = (marker: string): string => `@echo off\r\necho ran> "${marker}"\r\n`;
const exists = (f: string): Promise<boolean> => fs.access(f).then(() => true, () => false);

beforeEach(async () => {
  tmp = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'sb-resolve-')));
  root = path.join(tmp, 'repo');
  bin = path.join(tmp, 'safe bin (x86)'); // the shape of a real install folder
  await fs.mkdir(root);
  await fs.mkdir(bin);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await fs.rm(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

describe.runIf(WIN)('resolveCommand on Windows', () => {
  const PATHEXT = '.COM;.EXE;.BAT;.CMD';

  it('never picks a .cmd, .exe or .com planted in the project folder, even when it is on PATH', async () => {
    for (const ext of ['.cmd', '.exe', '.com']) await fs.writeFile(path.join(root, FAKE_NAME + ext), '');
    await fs.writeFile(path.join(bin, `${FAKE_NAME}.cmd`), '');
    const found = resolveCommand(FAKE_NAME, { PATH: `${root};${bin}`, PATHEXT, exclude: [root] });
    expect(found).toBe(path.join(bin, `${FAKE_NAME}.cmd`));
    expect(resolveCommand(FAKE_NAME, { PATH: root, PATHEXT, exclude: [root] })).toBeNull();
  });

  it('skips a folder inside the project, and the project through another spelling', async () => {
    const inner = path.join(root, 'node_modules', '.bin');
    await fs.mkdir(inner, { recursive: true });
    await fs.writeFile(path.join(inner, `${FAKE_NAME}.cmd`), '');
    await fs.writeFile(path.join(root, `${FAKE_NAME}.cmd`), '');
    expect(resolveCommand(FAKE_NAME, { PATH: inner, PATHEXT, exclude: [root] })).toBeNull();
    expect(resolveCommand(FAKE_NAME, { PATH: `${root.toUpperCase()}\\`, PATHEXT, exclude: [root] })).toBeNull();
  });

  it('skips empty and relative PATH entries, and drive-relative ones', async () => {
    await fs.writeFile(path.join(bin, `${FAKE_NAME}.cmd`), '');
    const rel = path.relative(process.cwd(), bin); // relative, and would find the file if it were followed
    const driveRelative = `\\${path.relative(path.parse(bin).root, bin)}`;
    expect(resolveCommand(FAKE_NAME, { PATH: `;.;..;${rel};${driveRelative}`, PATHEXT })).toBeNull();
    expect(resolveCommand(FAKE_NAME, { PATH: `;.;"${bin}"`, PATHEXT })).toBe(path.join(bin, `${FAKE_NAME}.cmd`));
  });

  it('follows PATH order first, then PATHEXT order, and only what Windows can start', async () => {
    const later = path.join(tmp, 'later');
    await fs.mkdir(later);
    await fs.writeFile(path.join(bin, `${FAKE_NAME}.cmd`), '');
    await fs.writeFile(path.join(bin, `${FAKE_NAME}.exe`), '');
    await fs.writeFile(path.join(later, `${FAKE_NAME}.exe`), '');
    expect(resolveCommand(FAKE_NAME, { PATH: `${bin};${later}`, PATHEXT })).toBe(path.join(bin, `${FAKE_NAME}.exe`));
    expect(resolveCommand(FAKE_NAME, { PATH: `${bin};${later}`, PATHEXT: '.CMD;.EXE' })).toBe(path.join(bin, `${FAKE_NAME}.cmd`));
    await fs.writeFile(path.join(root, FAKE_NAME), ''); // npm's sh shim has no extension
    await fs.writeFile(path.join(root, `${FAKE_NAME}.js`), '');
    expect(resolveCommand(FAKE_NAME, { PATH: root, PATHEXT: '.JS;.EXE' })).toBeNull();
  });

  it('falls back to the standard extensions without a PATHEXT', async () => {
    await fs.writeFile(path.join(bin, `${FAKE_NAME}.cmd`), '');
    expect(resolveCommand(FAKE_NAME, { PATH: bin })).toBe(path.join(bin, `${FAKE_NAME}.cmd`));
  });

  it('does not treat a folder as a command', async () => {
    await fs.mkdir(path.join(bin, `${FAKE_NAME}.cmd`));
    expect(resolveCommand(FAKE_NAME, { PATH: bin, PATHEXT })).toBeNull();
  });

  it('childEnv turns off the current-folder search, whatever the spelling or value already set', () => {
    vi.stubEnv(NO_CWD_VAR.toUpperCase(), '');
    const env = childEnv([]);
    const keys = Object.keys(env).filter((k) => k.toUpperCase() === NO_CWD_VAR.toUpperCase());
    expect(keys).toEqual([NO_CWD_VAR]);
    expect(env[NO_CWD_VAR]).toBe('1');
  });

  it('taskkill is the absolute System32 one, and a relative SystemRoot is not trusted', () => {
    expect(taskkillPath({ SystemRoot: 'D:\\Win' })).toBe('D:\\Win\\System32\\taskkill.exe');
    expect(taskkillPath({ SystemRoot: '.' })).toBe('C:\\Windows\\System32\\taskkill.exe');
    expect(taskkillPath({})).toBe('C:\\Windows\\System32\\taskkill.exe');
  });
});

describe.skipIf(WIN)('resolveCommand elsewhere', () => {
  it('takes only an executable from an absolute PATH entry outside the project', async () => {
    await fs.writeFile(path.join(root, FAKE_NAME), '#!/bin/sh\n', { mode: 0o755 });
    await fs.writeFile(path.join(bin, FAKE_NAME), '#!/bin/sh\n', { mode: 0o644 });
    expect(resolveCommand(FAKE_NAME, { PATH: `.:${root}:${bin}`, exclude: [root] })).toBeNull();
    await fs.chmod(path.join(bin, FAKE_NAME), 0o755);
    expect(resolveCommand(FAKE_NAME, { PATH: `.:${root}:${bin}`, exclude: [root] })).toBe(path.join(bin, FAKE_NAME));
  });
});

describe('the launcher', () => {
  it('gives an absolute path, or says not installed', async () => {
    const ext = WIN ? '.cmd' : '';
    await fs.writeFile(path.join(bin, FAKE_NAME + ext), '', { mode: 0o755 });
    const lookup = { PATH: `${root}${path.delimiter}${bin}`, PATHEXT: '.CMD' };
    expect(commandLauncher(FAKE_NAME, lookup)(['-p'], root)).toEqual({ bin: path.join(bin, FAKE_NAME + ext), args: ['-p'] });
    const none = () => commandLauncher(FAKE_NAME, { PATH: root, PATHEXT: '.CMD' })(['-p'], root);
    expect(none).toThrow(ClaudeUnavailableError);
    expect(none).toThrow("isn't installed");
  });
});

describe('RunManager and the planted command', () => {
  async function project(): Promise<{ entry: ProjectEntry; approved: ApprovedPermissions }> {
    const dir = path.join(root, '.specboard', 'specs', 'T-001-demo');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'spec.md'), SPEC);
    const entry = { id: projectId(root), root, name: 'repo' } as ProjectEntry;
    const approved = new ApprovedPermissions(path.join(tmp, 'home', 'permissions.json'));
    await approved.set(entry.id, root, { allow: ['Read(./**)'], deny: [] });
    return { entry, approved };
  }

  it.runIf(WIN)('Run starts the command on PATH, not the .cmd in the repo root, with the search variable unset', async () => {
    vi.stubEnv(NO_CWD_VAR, undefined as unknown as string); // a Claude session may set it, which would hide the bug
    const planted = path.join(tmp, 'planted-ran');
    const safe = path.join(tmp, 'safe-ran');
    await fs.writeFile(path.join(root, `${FAKE_NAME}.cmd`), markerCmd(planted));
    await fs.writeFile(path.join(bin, `${FAKE_NAME}.cmd`), markerCmd(safe));
    const { entry, approved } = await project();

    await new Promise<RunSnapshot>((resolve) => {
      const m = new RunManager({
        approved,
        status: async () => OK_STATUS,
        command: commandLauncher(FAKE_NAME, { PATH: `${root};${bin}`, PATHEXT: '.CMD' }),
        emit: (_pid, e: RunEvent) => {
          if (e.type === 'run-ended') resolve(e.run);
        },
      });
      void m.start(entry, 'run', 'T-001');
    });
    expect(await exists(safe)).toBe(true);
    expect(await exists(planted)).toBe(false);
  });

  it('a default manager with no `claude` on PATH refuses as not installed, and starts nothing', async () => {
    const empty = path.join(tmp, 'empty');
    await fs.mkdir(empty);
    vi.stubEnv('PATH', empty);
    const { entry, approved } = await project();
    const events: RunEvent[] = [];
    const m = new RunManager({ approved, status: async () => OK_STATUS, emit: (_pid, e) => events.push(e) });
    await expect(m.start(entry, 'run', 'T-001')).rejects.toBeInstanceOf(ClaudeUnavailableError);
    expect(events).toEqual([]);
    expect(m.current(entry.id)).toBeNull();
  });
});

describe('the status runner', () => {
  it.runIf(WIN)('runs the absolute path it found and reads its output', async () => {
    await fs.writeFile(path.join(bin, `${FAKE_NAME}.cmd`), '@echo off\r\necho 9.9.9 (fake)\r\n');
    const out = await commandRunner(FAKE_NAME, { PATH: bin, PATHEXT: '.CMD' }, async () => [])(['--version']);
    expect(out.code).toBe(0);
    expect(out.stdout).toContain('9.9.9');
  });

  it('rejects when the command is not found, so it reads as not installed', async () => {
    await expect(commandRunner(FAKE_NAME, { PATH: bin, PATHEXT: '.CMD' }, async () => [])(['--version'])).rejects.toThrow(/not found/);
  });
});
