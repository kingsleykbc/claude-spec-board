// Bundles the CLI + server into one file and copies the web build into the plugin folder.
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const plugin = path.join(root, 'plugin');

await build({
  entryPoints: [path.join(root, 'packages/server/src/cli.ts')],
  outfile: path.join(plugin, 'bin/specboard.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  define: { __SPECBOARD_BUNDLE__: 'true' },
  banner: {
    js: "#!/usr/bin/env node\nimport { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
  minify: false,
  sourcemap: false,
  logLevel: 'info',
});

const webDist = path.join(root, 'packages/web/dist');
if (!fs.existsSync(webDist)) throw new Error('packages/web/dist is missing: build the web package first');
fs.rmSync(path.join(plugin, 'web'), { recursive: true, force: true });
fs.cpSync(webDist, path.join(plugin, 'web'), { recursive: true });

fs.writeFileSync(path.join(plugin, 'bin/specboard.cmd'), '@node "%~dp0specboard.mjs" %*\r\n');
fs.writeFileSync(path.join(plugin, 'bin/specboard'), '#!/bin/sh\nexec node "$(dirname "$0")/specboard.mjs" "$@"\n', { mode: 0o755 });

// File modes do not survive Windows; make sure git records the shim as executable (no-op outside git).
spawnSync('git', ['update-index', '--add', '--chmod=+x', 'plugin/bin/specboard'], { cwd: root, stdio: 'ignore' });
