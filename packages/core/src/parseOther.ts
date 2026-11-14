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
export interface ProjectConfig { name: string; created: string | null; references: string[]; milestones: string[]; closingSteps: string[]; description: string; problems: string[] }
export interface ProjectSettings { trackTokens: boolean; problems: string[] }
export interface Overview { updated: string | null; summaryMd: string }

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
  const config: ProjectConfig = { name: '', created: null, references: [], milestones: [], closingSteps: [], description: body.trim(), problems };
  if (!data) return config;
  config.name = optionalString(data.name) ?? '';
  config.created = optionalString(data.created);
  config.references = stringList(data.references);
  config.milestones = [...new Set(stringList(data.milestones).map((m) => m.trim()).filter((m) => m !== ''))];
  config.closingSteps = stringList(data.closing_steps);
  return config;
}

/** Parse .specboard/overview.md. Never throws; bad YAML yields updated: null. */
export function parseOverview(text: string): Overview {
  const { yaml, body } = splitFrontMatter(text);
  const { data } = parseMapping(yaml);
  return { updated: data ? optionalString(data.updated) : null, summaryMd: body.trim() };
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
