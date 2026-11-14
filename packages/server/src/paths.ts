import fs from 'node:fs';
import path from 'node:path';

/** Set to `true` by esbuild (`define`) when the server is bundled into `plugin/bin`; undefined when run from source. */
declare const __SPECBOARD_BUNDLE__: boolean | undefined;
const BUNDLED = typeof __SPECBOARD_BUNDLE__ !== 'undefined' && __SPECBOARD_BUNDLE__;

/** True when this is the plugin's bundle, false when run from the Spec Board repo. */
export const isBundled = (): boolean => BUNDLED;

/** Source: this file is `<repo>/packages/server/src`. Bundle: the bundle sits in `<plugin>/bin`. */
const HERE = import.meta.dirname;

/** The Claude Code plugin folder (skills and manifest). */
export function pluginDir(): string {
  return BUNDLED ? path.resolve(HERE, '..') : path.resolve(HERE, '..', '..', '..', 'plugin');
}

/** The built web app, or null when it has not been built. */
export function webDistDir(): string | null {
  const dir = BUNDLED ? path.resolve(HERE, '..', 'web') : path.resolve(HERE, '..', '..', 'web', 'dist');
  return fs.existsSync(dir) ? dir : null;
}
