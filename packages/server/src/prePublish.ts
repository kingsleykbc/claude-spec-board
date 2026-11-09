// Until Spec Board is published, `specboard` isn't on the PATH. Delete this file in M4 (see m3-followups.md), as with
// packages/web/src/lib/prePublish.ts; the callers then keep only their `specboard ...` wording.

const projectPath = (root?: string): string => (root ? `"${root}"` : '<project path>');

/** How to set a project up, for CLI output. */
export const initHint = (root?: string): string =>
  `Run \`specboard init\` in a terminal. Until Spec Board is published, run it from the Spec Board repo as \`npm run specboard -- init ${projectPath(root)}\`.`;

/** How to open the board, for CLI output. */
export const boardCommand = (root: string): string => `npm run board -- ${projectPath(root)}`;
