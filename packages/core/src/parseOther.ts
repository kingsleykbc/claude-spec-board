import { isScalar, parseDocument, type Document } from 'yaml';
import { splitFrontMatter } from './frontmatter.js';

export interface LogEntry { at: string; text: string }
export interface SubtaskLog { subtask: number | null; commit: string | null; files: string[]; pr: string | null; entries: LogEntry[]; problems: string[] }
export interface ProjectConfig { name: string; references: string[]; milestones: string[]; closingSteps: string[]; description: string; problems: string[] }
export interface Overview { updated: string | null; summaryMd: string }

/** Parse YAML into a mapping. Never throws; returns null data plus problems when unusable. */
function parseMapping(yaml: string | null): { data: Record<string, unknown> | null; problems: string[]; doc?: Document } {
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
  const log: SubtaskLog = { subtask: null, commit: null, files: [], pr: null, entries: parseEntries(body), problems };
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
  return log;
}

/** Parse .specboard/config.md. Never throws. */
export function parseConfig(text: string): ProjectConfig {
  const { yaml, body } = splitFrontMatter(text);
  const { data, problems } = parseMapping(yaml);
  const config: ProjectConfig = { name: '', references: [], milestones: [], closingSteps: [], description: body.trim(), problems };
  if (!data) return config;
  config.name = optionalString(data.name) ?? '';
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
