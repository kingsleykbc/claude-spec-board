import fs from 'node:fs/promises';
import path from 'node:path';
import { parseSettings } from '@specboard/core';

export interface TokenHookInput {
  transcript_path: string;
  session_id: string;
  tool_input: { file_path?: string };
  cwd?: string;
}

const LOG_PATH = /^(.*)\/\.specboard\/specs\/[^/]+\/logs\/\d+-[^/]*\.md$/;
const SPEC_PATH = /^(.*)\/\.specboard\/specs\/[^/]+\/spec\.md$/;
/** The entry sync writes when it ticks a subtask: the work was not done in this session. */
const SYNC_TICK = 'Ticked by sync';

/** Total tokens in a Claude Code transcript; each `message.id` is counted once. */
export function transcriptTotal(text: string): number {
  const seen = new Set<string>();
  let total = 0;
  for (const raw of text.split('\n')) {
    if (!raw.trim()) continue;
    let o: any;
    try {
      o = JSON.parse(raw);
    } catch {
      continue;
    }
    if (o?.type !== 'assistant') continue;
    const id = o.message?.id;
    if (typeof id === 'string') {
      if (seen.has(id)) continue;
      seen.add(id);
    }
    const u = o.message?.usage;
    if (!u) continue;
    for (const k of ['input_tokens', 'output_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens']) {
      if (typeof u[k] === 'number' && Number.isFinite(u[k])) total += u[k];
    }
  }
  return total;
}

/** Add `delta` to the `tokens:` front matter line (or append one). Null when there is no front matter. */
export function addTokens(text: string, delta: number): string | null {
  const m = /^---(\r?\n)([\s\S]*?)(\r?\n)---(?=\r?\n|$)/.exec(text);
  if (!m) return null;
  const nl = m[1]!;
  const lines = m[2]!.split(/\r?\n/);
  const i = lines.findIndex((l) => /^tokens\s*:/.test(l));
  if (i >= 0) {
    const old = Number(lines[i]!.slice(lines[i]!.indexOf(':') + 1).trim());
    lines[i] = `tokens: ${(Number.isFinite(old) ? old : 0) + delta}`;
  } else lines.push(`tokens: ${delta}`);
  return `---${nl}${lines.join(nl)}${m[3]}---` + text.slice(m[0].length);
}

/** The project root of a subtask log file (`<root>/.specboard/specs/<spec>/logs/<n>-*.md`), with forward slashes; null for any other file. */
export function logFileRoot(abs: string): string | null {
  return LOG_PATH.exec(abs.replace(/\\/g, '/'))?.[1] ?? null;
}

/** The project root of a spec file (`<root>/.specboard/specs/<spec>/spec.md`), with forward slashes; null for any other file. */
export function specFileRoot(abs: string): string | null {
  return SPEC_PATH.exec(abs.replace(/\\/g, '/'))?.[1] ?? null;
}

/** Whether the project's `track_tokens` is on (it is when settings.md or the key is missing). */
export async function trackTokensOn(root: string): Promise<boolean> {
  const settings = await readIfExists(path.join(root, '.specboard', 'settings.md'));
  return settings === null || parseSettings(settings).trackTokens;
}

/** Adds `delta` to a log file's `tokens:`. False when the file is missing or has no front matter. */
export async function addTokensToLog(abs: string, delta: number): Promise<boolean> {
  const log = await readIfExists(abs);
  if (log === null) return false;
  const next = addTokens(log, delta);
  if (next === null) return false;
  await fs.writeFile(abs, next);
  return true;
}

async function readIfExists(file: string): Promise<string | null> {
  try {
    return await fs.readFile(file, 'utf8');
  } catch {
    return null;
  }
}

async function saveCheckpoint(file: string, total: number): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify({ total }));
  await fs.rename(tmp, file);
}

/**
 * PostToolUse hook: add the tokens spent since the last checkpoint to the subtask log just written.
 * A spec file write (for example setting `current_subtask`) only moves the checkpoint, so chat and planning before the
 * work are not counted on the next log. A log ticked by sync gets nothing either: that work was not done in this session.
 */
export async function runTokenHook(input: TokenHookInput, opts: { dataDir: string }): Promise<{ wrote: number } | null> {
  try {
    const target = input.tool_input?.file_path;
    if (typeof target !== 'string' || !input.transcript_path || !input.session_id) return null;
    const abs = path.resolve(input.cwd ?? process.cwd(), target);
    const logRoot = logFileRoot(abs);
    const specRoot = logRoot === null ? specFileRoot(abs) : null;
    const root = logRoot ?? specRoot;
    if (root === null || !(await trackTokensOn(root))) return null;

    const transcript = await readIfExists(input.transcript_path);
    if (transcript === null) return null;
    const total = transcriptTotal(transcript);

    const checkpoint = path.join(opts.dataDir, 'tokens', `${path.basename(input.session_id)}.json`);
    if (specRoot !== null) {
      await saveCheckpoint(checkpoint, total);
      return { wrote: 0 };
    }
    const log = await readIfExists(abs);
    if (log?.includes(SYNC_TICK)) {
      await saveCheckpoint(checkpoint, total);
      return { wrote: 0 };
    }

    let prev = 0;
    const saved = await readIfExists(checkpoint);
    if (saved !== null) {
      try {
        const n = JSON.parse(saved)?.total;
        if (typeof n === 'number' && Number.isFinite(n)) prev = n;
      } catch {
        // an unreadable checkpoint counts as a new session
      }
    }

    const delta = total - prev;
    if (delta <= 0) {
      await saveCheckpoint(checkpoint, total);
      return { wrote: 0 };
    }
    if (!(await addTokensToLog(abs, delta))) return null;
    await saveCheckpoint(checkpoint, total);
    return { wrote: delta };
  } catch {
    return null;
  }
}
