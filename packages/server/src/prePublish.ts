// Until Spec Board is published, `specboard` isn't on the PATH when run from the repo. Delete the repo wording in M4
// (see m3-followups.md), as with packages/web/src/lib/prePublish.ts; the callers then keep only their `specboard ...`
// wording. The plugin's bundle has `specboard` on Claude's PATH, so its wording points at Claude instead.
import { isBundled } from './paths.js';

const projectPath = (root?: string): string => (root ? `"${root}"` : '<project path>');

/** How to set a project up, for CLI output. */
export const initHint = (root?: string, bundled = isBundled()): string =>
  bundled
    ? `Ask Claude to run /specboard:setup, or to run \`specboard init --yes --no-skills --runs yes ${projectPath(root)}\`.`
    : `Run \`specboard init\` in a terminal. Until Spec Board is published, run it from the Spec Board repo as \`npm run specboard -- init ${projectPath(root)}\`.`;

/** How to open the board, for CLI output. */
export const boardCommand = (root: string, bundled = isBundled()): string => (bundled ? `specboard ${projectPath(root)}` : `npm run board -- ${projectPath(root)}`);

/** The last line of a finished `init`: how to open the board. */
export const nextLine = (root: string, bundled = isBundled()): string =>
  bundled ? `Open the board with \`${boardCommand(root, true)}\`.` : `Next, from the Spec Board repo, open the board: ${boardCommand(root, false)}`;
