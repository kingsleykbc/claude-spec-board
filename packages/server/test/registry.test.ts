import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Registry } from '../src/registry.js';

let tmp: string;
beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'sb-reg-'));
});
afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe('Registry', () => {
  it('adds the same folder twice as one entry and creates the file on first write', async () => {
    const file = path.join(tmp, 'sub', 'projects.json');
    const reg = new Registry(file);
    expect(await reg.list()).toEqual([]);
    await expect(fs.access(file)).rejects.toThrow();
    const proj = path.join(tmp, 'my-proj');
    await fs.mkdir(proj);
    const a = await reg.add(proj);
    const b = await reg.add(proj);
    expect(b).toEqual(a);
    expect(await reg.list()).toHaveLength(1);
    expect(a.id).toMatch(/^[0-9a-f]{8}$/);
    expect(await reg.get(a.id)).toEqual(a);
    expect(await reg.get('nope')).toBeNull();
    await fs.access(file);
  });

  it('uses the folder name when there is no config, and config.name when there is', async () => {
    const reg = new Registry(path.join(tmp, 'projects.json'));
    const plain = path.join(tmp, 'plain-folder');
    await fs.mkdir(plain);
    expect((await reg.add(plain)).name).toBe('plain-folder');
    const named = path.join(tmp, 'named');
    await fs.mkdir(path.join(named, '.specboard'), { recursive: true });
    await fs.writeFile(path.join(named, '.specboard', 'config.md'), '---\nname: "Fancy Name"\nreferences: []\n---\n');
    expect((await reg.add(named)).name).toBe('Fancy Name');
  });

  it('survives a second instance reading the same file and concurrent adds', async () => {
    const file = path.join(tmp, 'projects.json');
    const reg = new Registry(file);
    const dirs = await Promise.all(
      ['a', 'b', 'c'].map(async (n) => {
        const d = path.join(tmp, n);
        await fs.mkdir(d);
        return d;
      }),
    );
    await Promise.all(dirs.map((d) => reg.add(d)));
    expect(await new Registry(file).list()).toHaveLength(3);
  });
});
