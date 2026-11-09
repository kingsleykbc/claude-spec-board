// Until Spec Board is published, `specboard` isn't on the PATH. Delete this file in M4 (see m3-followups.md); the
// callers then keep only their `specboard ...` wording.

const projectPath = (root?: string): string => (root ? `"${root}"` : '<project path>');
const fromRepo = (command: string): string => `Until Spec Board is published, run it from the Spec Board repo as \`npm run specboard -- ${command}\`.`;

/** The line under a rule offered by `specboard allow`. */
export const allowHint = (root?: string): string => fromRepo(`allow "<rule>" ${projectPath(root)}`);

/** The not-approved toast's sub-line. */
export const initHint = (root?: string): string => `Run \`specboard init\` in a terminal. ${fromRepo(`init ${projectPath(root)}`)}`;
