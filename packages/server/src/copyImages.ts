import fs from 'node:fs/promises';
import path from 'node:path';
import { isImageName, loadProject } from '@specboard/core';

/**
 * Copies every image file from one spec's `images/` folder into another's (created when missing). Never overwrites:
 * a name that is taken gets `-2`, `-3`... before the extension, like the board's upload. Returns the exit code.
 */
export async function copyImagesCommand(a: { from: string; to: string; path: string }, log: (m: string) => void = console.log, err: (m: string) => void = console.error): Promise<number> {
  const project = await loadProject(a.path);
  if (project.config === null && project.specs.length === 0 && project.problems[0] === 'No .specboard folder') {
    err(`No .specboard folder in ${a.path}`);
    return 1;
  }
  for (const id of [a.from, a.to]) {
    if (!project.specs.some((s) => s.id === id)) {
      err(project.archived.some((s) => s.id === id) ? `Spec ${id} is archived in ${a.path}` : `No spec ${id} in ${a.path}`);
      return 1;
    }
  }
  const src = path.join(path.dirname(project.specs.find((s) => s.id === a.from)!.path), 'images');
  const dst = path.join(path.dirname(project.specs.find((s) => s.id === a.to)!.path), 'images');
  const names = await fs.readdir(src).then((n) => n.filter(isImageName).sort(), () => [] as string[]);
  if (names.length === 0) {
    log(`No images in ${a.from}.`);
    return 0;
  }
  await fs.mkdir(dst, { recursive: true });
  for (const name of names) {
    const ext = path.extname(name);
    const stem = name.slice(0, name.length - ext.length);
    const bytes = await fs.readFile(path.join(src, name));
    for (let n = 1; ; n++) {
      const file = `${n === 1 ? stem : `${stem}-${n}`}${ext}`;
      try {
        await fs.writeFile(path.join(dst, file), bytes, { flag: 'wx' });
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'EEXIST') continue;
        throw e;
      }
      log(`images/${name} -> images/${file}`);
      break;
    }
  }
  return 0;
}

export function parseCopyImagesArgs(argv: string[]): { from: string; to: string; path: string } {
  const base = process.env.INIT_CWD || process.cwd();
  const bad = argv.find((a) => a.startsWith('--'));
  if (bad) throw new Error(`Unknown option: ${bad}`);
  if (argv.length < 2 || argv.length > 3) throw new Error('Usage: specboard copy-images <from-ID> <to-ID> [project folder]');
  return { from: argv[0]!, to: argv[1]!, path: argv[2] ? path.resolve(base, argv[2]) : base };
}
