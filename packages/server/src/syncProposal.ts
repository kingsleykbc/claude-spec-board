import fs from 'node:fs/promises';
import path from 'node:path';
import { archiveSpec, loadProject, parseMapping, splitFrontMatter } from '@specboard/core';

export interface SyncProposal {
  head: string | null;
  changes: number | null;
  created: string | null;
  scope: string | null;
  bodyMd: string;
  problems: string[];
}

export const proposalFile = (root: string): string => path.join(root, '.specboard', 'sync-proposal.md');

/** The proposal's text, or null when there is none. */
export async function readProposalText(root: string): Promise<string | null> {
  try {
    return await fs.readFile(proposalFile(root), 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
}

/** Removes the proposal. Nothing there is fine. */
export async function deleteProposal(root: string): Promise<void> {
  await fs.rm(proposalFile(root), { force: true });
}

const text = (v: unknown): string | null => (v === null || v === undefined || typeof v === 'object' ? null : String(v).trim() || null);

/** Reads a proposal file. Never throws: broken front matter gives `problems`, null fields and the whole text as the body. */
export function parseProposal(raw: string): SyncProposal {
  const { yaml, body } = splitFrontMatter(raw);
  const { data, problems } = parseMapping(yaml);
  if (data === null) return { head: null, changes: null, created: null, scope: null, bodyMd: yaml === null ? raw : body, problems };
  const c = typeof data.changes === 'number' ? data.changes : text(data.changes);
  const n = c === null ? Number.NaN : Number(c);
  return {
    head: text(data.head),
    changes: Number.isInteger(n) && n >= 0 ? n : null,
    created: text(data.created),
    scope: text(data.scope),
    bodyMd: body,
    problems,
  };
}

const ARCHIVE_LINE = /^\s*\d+\.\s+Archive\s+(T-\d+)\b/gm;

/** The spec IDs named on `Archive <ID>` operation lines, in order, once each. */
export function archiveIds(bodyMd: string): string[] {
  return [...new Set([...bodyMd.matchAll(ARCHIVE_LINE)].map((m) => m[1]!))];
}

/**
 * Archives the specs a proposal names. Skips IDs that are not on the board or are archived already. Never throws:
 * returns one message per spec that could not be archived.
 */
export async function archiveProposed(root: string, ids: string[]): Promise<string[]> {
  const failures: string[] = [];
  let active: Set<string>;
  try {
    active = new Set((await loadProject(root)).specs.map((s) => s.id));
  } catch (e) {
    return ids.map((id) => `Could not archive ${id}: ${(e as Error).message}`);
  }
  for (const id of ids) {
    if (!active.has(id)) continue;
    try {
      await archiveSpec(root, id);
    } catch (e) {
      failures.push(`Could not archive ${id}: ${(e as Error).message}`);
    }
  }
  return failures;
}
