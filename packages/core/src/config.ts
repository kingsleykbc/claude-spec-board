import { setTopLevelKey } from './edit.js';

/**
 * Set the `references:` list in config.md as a flow list (`references: [CLAUDE.md, docs/X.md]`).
 * Only that key's lines change; the rest of the file stays byte-identical. Adds the key before the
 * closing `---` when absent.
 */
export function setConfigReferences(text: string, refs: string[]): string {
  if (!Array.isArray(refs) || !refs.every((r) => typeof r === 'string')) throw new Error('Invalid value for references');
  return setTopLevelKey(text, 'references', refs);
}
