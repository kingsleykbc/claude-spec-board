import { pathToFileURL } from 'node:url';
import { start } from './start.js';

export function parseArgs(argv: string[]): { path: string; port: number; open: boolean } {
  let dir = process.cwd();
  let port = 4949;
  let open = true;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--no-open') open = false;
    else if (a === '--port') {
      const raw = argv[++i];
      const n = Number(raw);
      if (raw === undefined || !Number.isInteger(n) || n < 0 || n > 65535) throw new Error(`Invalid port: ${raw ?? '(missing)'}`);
      port = n;
    } else if (a.startsWith('--')) throw new Error(`Unknown option: ${a}`);
    else dir = a;
  }
  return { path: dir, port, open };
}

async function main(): Promise<void> {
  const { url, close } = await start(parseArgs(process.argv.slice(2)));
  console.log(`Spec Board running at ${url}`);
  const stop = () => void close().then(() => process.exit(0));
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
}
