import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import treeKill from 'tree-kill';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const BUNDLE = path.join(ROOT, 'plugin/bin/specboard.mjs');
const SAMPLE = path.join(ROOT, 'examples/recipe-box');

function newestMtime(dir: string): { file: string; mtime: number } {
  let best = { file: '', mtime: 0 };
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    const r = e.isDirectory() ? newestMtime(p) : { file: p, mtime: fs.statSync(p).mtimeMs };
    if (r.mtime > best.mtime) best = r;
  }
  return best;
}

let tmp: string;
let child: ChildProcess | undefined;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'specboard-bundle-'));
});

afterEach(async () => {
  if (child?.pid) await new Promise<void>((r) => treeKill(child!.pid!, () => r()));
  child = undefined;
  fs.rmSync(tmp, { recursive: true, force: true });
});

function run(args: string[]) {
  return spawnSync('node', [BUNDLE, ...args], { encoding: 'utf8', env: { ...process.env, SPECBOARD_HOME: path.join(tmp, 'home') } });
}

describe('plugin bundle', () => {
  it('prints the plugin.json version', () => {
    const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'plugin/.claude-plugin/plugin.json'), 'utf8')).version;
    const r = run(['--version']);
    expect(r.stdout.trim()).toBe(version);
  });

  it('prints the project tree', () => {
    const r = run(['tree', SAMPLE]);
    expect(r.stdout.startsWith('Recipe Box')).toBe(true);
  });

  it('serves the board with --no-open --port 0', async () => {
    const dir = path.join(tmp, 'recipe-box');
    fs.cpSync(SAMPLE, dir, { recursive: true });
    child = spawn('node', [BUNDLE, dir, '--no-open', '--port', '0'], {
      env: { ...process.env, SPECBOARD_HOME: path.join(tmp, 'home') },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const url = await new Promise<string>((resolve, reject) => {
      let out = '';
      const timer = setTimeout(() => reject(new Error(`no URL printed: ${out}`)), 15000);
      child!.stdout!.on('data', (d: Buffer) => {
        out += d.toString();
        const m = /(http:\/\/\S+)/.exec(out);
        if (m) {
          clearTimeout(timer);
          resolve(m[1]!);
        }
      });
      child!.on('exit', () => reject(new Error(`exited early: ${out}`)));
    });
    const health = await (await fetch(new URL('/api/health', url))).json();
    expect(health).toMatchObject({ app: 'specboard' });
    const page = await fetch(url);
    expect(page.headers.get('content-type')).toContain('text/html');
    expect(await page.text()).toContain('<html');
  }, 30000);

  it.skipIf(!!process.env.CI)('is not older than its sources (git checkouts reset mtimes, so skipped on CI)', () => {
    expect(fs.existsSync(BUNDLE), 'plugin/bin/specboard.mjs missing: run npm run build:plugin').toBe(true);
    const bundleTime = fs.statSync(BUNDLE).mtimeMs;
    for (const d of ['packages/core/src', 'packages/server/src', 'packages/web/src', 'plugin/skills']) {
      const n = newestMtime(path.join(ROOT, d));
      expect(bundleTime >= n.mtime, `${n.file} is newer than the bundle: run npm run build:plugin`).toBe(true);
    }
  });
});
