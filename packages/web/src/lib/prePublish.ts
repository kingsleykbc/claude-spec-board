// Until Spec Board is published, `specboard` isn't on the PATH when run from the repo. Delete the repo wording in M4
// (see m3-followups.md); the callers then keep only their `specboard ...` wording. Plugin users have `specboard` only
// inside Claude Code, so their hints ask Claude to do it.
import { isPluginMode } from './mode';

const projectPath = (root?: string): string => (root ? `"${root}"` : '<project path>');
const fromRepo = (command: string): string => `Until Spec Board is published, run it from the Spec Board repo as \`npm run specboard -- ${command}\`.`;
const SETUP_AGAIN = 'Ask Claude to run /specboard:setup again to update the allowed commands';

/** The line under a rule offered by `specboard allow`. */
export const allowHint = (root?: string, plugin = isPluginMode()): string =>
  plugin
    ? `${SETUP_AGAIN}, or ask Claude to run \`specboard init --yes --no-skills --runs yes ${projectPath(root)}\`.`
    : fromRepo(`allow "<rule>" ${projectPath(root)}`);

/** The not-approved toast's sub-line. */
export const initHint = (root?: string, plugin = isPluginMode()): string =>
  plugin ? `${SETUP_AGAIN}.` : `Run \`specboard init\` in a terminal. ${fromRepo(`init ${projectPath(root)}`)}`;
