import { parseDocument } from 'yaml';
import type { SpecMeta, Status, Urgency } from './types.js';

const STATUSES: readonly Status[] = ['todo', 'doing', 'review', 'done'];
const URGENCIES: readonly Urgency[] = ['low', 'normal', 'high', 'urgent'];

const FRONT_MATTER = /^---[ \t]*\r?\n(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)/;

/** Split a spec file into its YAML front matter and body. bodyStartLine is the 0-based line index where the body begins. */
export function splitFrontMatter(text: string): { yaml: string | null; body: string; bodyStartLine: number } {
  const m = FRONT_MATTER.exec(text);
  if (!m) return { yaml: null, body: text, bodyStartLine: 0 };
  const consumed = m[0];
  const bodyStartLine = (consumed.match(/\n/g) ?? []).length;
  return { yaml: m[1] ?? '', body: text.slice(consumed.length), bodyStartLine };
}

function defaultMeta(): SpecMeta {
  return {
    id: '',
    title: '',
    status: 'todo',
    urgency: 'normal',
    categories: [],
    dependsOn: [],
    draft: false,
    currentSubtask: null,
    created: null,
    updated: null,
  };
}

function stringList(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  const items = Array.isArray(value) ? value : [value];
  return items.filter((v) => v !== null && typeof v !== 'object').map((v) => String(v));
}

function optionalString(value: unknown): string | null {
  return value === null || value === undefined || typeof value === 'object' ? null : String(value);
}

/** Parse front matter YAML into SpecMeta. Never throws; issues are collected in `problems`. */
export function parseSpecMeta(yaml: string | null): { meta: SpecMeta; problems: string[] } {
  const meta = defaultMeta();
  const problems: string[] = [];
  if (yaml === null) {
    problems.push('Missing front matter');
    return { meta, problems };
  }

  const doc = parseDocument(yaml);
  if (doc.errors.length > 0) {
    // Report the YAML failure once; the fields are not trustworthy.
    return { meta, problems: [`Invalid front matter: ${doc.errors[0]!.message}`] };
  }

  const data: unknown = doc.toJS();
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    if (data !== null) problems.push('Front matter must be a mapping');
    return { meta, problems };
  }
  const o = data as Record<string, unknown>;

  meta.id = optionalString(o.id) ?? '';
  meta.title = optionalString(o.title) ?? '';

  if (o.status !== undefined && o.status !== null) {
    const s = String(o.status);
    if ((STATUSES as readonly string[]).includes(s)) meta.status = s as Status;
    else problems.push(`Unknown status "${s}"`);
  }
  if (o.urgency !== undefined && o.urgency !== null) {
    const u = String(o.urgency);
    if ((URGENCIES as readonly string[]).includes(u)) meta.urgency = u as Urgency;
    else problems.push(`Unknown urgency "${u}"`);
  }

  meta.categories = stringList(o.categories);
  meta.dependsOn = stringList(o.depends_on);
  meta.draft = o.draft === true;

  if (o.current_subtask !== undefined && o.current_subtask !== null) {
    const n = Number(o.current_subtask);
    if (Number.isInteger(n)) meta.currentSubtask = n;
    else problems.push(`Invalid current_subtask "${String(o.current_subtask)}"`);
  }

  meta.created = optionalString(o.created);
  meta.updated = optionalString(o.updated);
  return { meta, problems };
}
