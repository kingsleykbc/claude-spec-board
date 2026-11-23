/**
 * The project description for the Overview: the config.md body before its first `##` heading. The body also holds
 * sections for Claude (Stack, Design, ...) that don't belong in a summary of the project.
 */
export function projectDescription(body: string): string {
  const cut = body.search(/^##[ \t]/m);
  return (cut === -1 ? body : body.slice(0, cut)).trim();
}
