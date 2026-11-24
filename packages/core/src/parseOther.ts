import { isScalar, parseDocument, type Document } from 'yaml';
import { splitFrontMatter } from './frontmatter.js';

export interface LogEntry { at: string; text: string }
export interface SubtaskLog {
  subtask: number | null;
  commit: string | null;
  files: string[];
  pr: string | null;
  /** `done_at` as written. */
  doneAt: string | null;
  /** Tokens spent on the subtask; null when absent or invalid. */
  tokens: number | null;
  /** Set when the subtask was dropped as obsolete: `"<date>: <reason>"`. */
  obsolete: { since: string | null; reason: string } | null;
  entries: LogEntry[];
  problems: string[];
}
export interface ProjectConfig { name: string; created: string | null; references: string[]; milestones: string[]; closingSteps: string[]; commits: boolean | null; specsInGit: boolean | null; testCommand: string | null; description: string; problems: string[] }
export interface ProjectSettings { trackTokens: boolean; problems: string[] }
export interface Overview {
  updated: string | null;
  /** The summary, without the `## Out of sync` section. */
  summaryMd: string;
  /** The text of the `## Out of sync` section: the board and the code disagree. Null when there is none. */
  outOfSync: string | null;
}

/** Parse YAML into a mapping. Never throws; returns null data plus problems when unusable. */
export function parseMapping(yaml: string | null): { data: Record<string, unknown> | null; problems: string[]; doc?: Document } {
  if (yaml === null) return { data: null, problems: ['Missing front matter'] };
  const doc = parseDocument(yaml);
  if (doc.errors.length > 0) return { data: null, problems: [`Invalid front matter: ${doc.errors[0]!.message}`] };
  const data: unknown = doc.toJS();
  if (data === null || data === undefined) return { data: {}, problems: [] };
  if (typeof data !== 'object' || Array.isArray(data)) return { data: null, problems: ['Front matter must be a mapping'] };
  return { data: data as Record<string, unknown>, problems: [], doc };
}

function optionalString(value: unknown): string | null {
  if (value === null || value === undefined || typeof value === 'object') return null;
  const s = String(value).trim();
  return s === '' ? null : s;
}

function stringList(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  const items = Array.isArray(value) ? value : [value];
  return items.filter((v) => v !== null && typeof v !== 'object').map((v) => String(v));
}

// `YYYY-MM-DD HH:mm`, optional `:ss`, space or `T` between date and time, optional `Z` or `±HH:mm`.
const ENTRY_HEADING = /^### (\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})?)[ \t]*$/;

function parseEntries(body: string): LogEntry[] {
  const entries: LogEntry[] = [];
  let current: { at: string; lines: string[] } | null = null;
  const flush = () => {
    if (current) entries.push({ at: current.at, text: current.lines.join('\n').trim() });
  };
  for (const line of body.split(/\r?\n/)) {
    const m = ENTRY_HEADING.exec(line);
    if (m) {
      flush();
      current = { at: m[1]!, lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  flush();
  return entries;
}

/** Parse a subtask log file. Never throws. */
export function parseLog(text: string): SubtaskLog {
  const { yaml, body } = splitFrontMatter(text);
  const { data, problems, doc } = parseMapping(yaml);
  const log: SubtaskLog = { subtask: null, commit: null, files: [], pr: null, doneAt: null, tokens: null, obsolete: null, entries: parseEntries(body), problems };
  if (!data) return log;
  if (data.subtask !== undefined && data.subtask !== null) {
    const n = typeof data.subtask === 'number' ? data.subtask : Number(data.subtask);
    if (Number.isInteger(n)) log.subtask = n;
    else problems.push(`Invalid subtask "${String(data.subtask)}"`);
  } else {
    problems.push('Missing subtask');
  }
  // Use the scalar as written: YAML would turn hashes like 12e4567 or 0012345 into numbers.
  const commit = doc?.get('commit', true);
  log.commit =
    isScalar(commit) && commit.value !== null && typeof commit.source === 'string'
      ? optionalString(commit.source)
      : optionalString(data.commit);
  log.files = stringList(data.files);
  log.pr = optionalString(data.pr);
  log.doneAt = optionalString(data.done_at);
  if (data.tokens !== undefined && data.tokens !== null) {
    const t = data.tokens;
    if (typeof t === 'number' && Number.isInteger(t) && t >= 0) log.tokens = t;
    else problems.push('Invalid tokens');
  }
  const obsolete = optionalString(data.obsolete);
  if (obsolete !== null) {
    const i = obsolete.indexOf(': ');
    log.obsolete = i < 0 ? { since: null, reason: obsolete } : { since: obsolete.slice(0, i).trim() || null, reason: obsolete.slice(i + 2).trim() };
  }
  return log;
}

/** Parse .specboard/config.md. Never throws. */
export function parseConfig(text: string): ProjectConfig {
  const { yaml, body } = splitFrontMatter(text);
  const { data, problems } = parseMapping(yaml);
  const config: ProjectConfig = { name: '', created: null, references: [], milestones: [], closingSteps: [], commits: null, specsInGit: null, testCommand: null, description: body.trim(), problems };
  if (!data) return config;
  config.name = optionalString(data.name) ?? '';
  config.created = optionalString(data.created);
  config.references = stringList(data.references);
  config.milestones = [...new Set(stringList(data.milestones).map((m) => m.trim()).filter((m) => m !== ''))];
  config.closingSteps = stringList(data.closing_steps);
  const commits = data.commits;
  if (typeof commits === 'boolean') config.commits = commits;
  else if (commits !== undefined && commits !== null) problems.push(`Invalid commits "${String(commits)}"`);
  const specsInGit = data.specs_in_git;
  if (typeof specsInGit === 'boolean') config.specsInGit = specsInGit;
  else if (specsInGit !== undefined && specsInGit !== null) problems.push(`Invalid specs_in_git "${String(specsInGit)}"`);
  const testCommand = data.test_command;
  if (typeof testCommand === 'string' && testCommand.trim() !== '') config.testCommand = testCommand;
  else if (testCommand !== undefined && testCommand !== null) problems.push(`Invalid test_command "${String(testCommand)}"`);
  return config;
}

const OUT_OF_SYNC = /^##[ \t]+out of sync[ \t]*$/i;
const H2 = /^##[ \t]/;
const FENCE = /^[ \t]{0,3}(```|~~~)/;

/**
 * Splits the `## Out of sync` section (refresh-overview's warning that the board and the code disagree) out of the
 * overview body: from its heading to the next `## ` heading or the end. Headings inside code blocks don't count.
 */
function splitOutOfSync(body: string): { summaryMd: string; outOfSync: string | null } {
  const lines = body.split(/\r?\n/);
  let fence: string | null = null;
  let start = -1;
  let end = lines.length;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const f = FENCE.exec(line);
    if (f) {
      if (fence === null) fence = f[1]!;
      else if (f[1] === fence) fence = null;
      continue;
    }
    if (fence !== null) continue;
    if (start === -1 && OUT_OF_SYNC.test(line)) start = i;
    else if (start !== -1 && H2.test(line)) {
      end = i;
      break;
    }
  }
  if (start === -1) return { summaryMd: body.trim(), outOfSync: null };
  const section = lines.slice(start + 1, end).join('\n').trim();
  const rest = [...lines.slice(0, start), ...lines.slice(end)].join('\n').trim();
  return { summaryMd: rest.replace(/\n{3,}/g, '\n\n'), outOfSync: section === '' ? null : section };
}

/** Parse .specboard/overview.md. Never throws; bad YAML yields updated: null. `summaryMd` leaves out `## Out of sync`. */
export function parseOverview(text: string): Overview {
  const { yaml, body } = splitFrontMatter(text);
  const { data } = parseMapping(yaml);
  return { updated: data ? optionalString(data.updated) : null, ...splitOutOfSync(body) };
}

/** Parse .specboard/settings.md. Never throws; `trackTokens` defaults to true. */
export function parseSettings(text: string): ProjectSettings {
  const { yaml } = splitFrontMatter(text);
  const { data, problems } = parseMapping(yaml);
  const settings: ProjectSettings = { trackTokens: true, problems: yaml === null ? [] : problems };
  if (!data) return settings;
  const v = data.track_tokens;
  if (typeof v === 'boolean') settings.trackTokens = v;
  else if (v !== undefined && v !== null) settings.problems.push(`Invalid track_tokens "${String(v)}"`);
  return settings;
}
