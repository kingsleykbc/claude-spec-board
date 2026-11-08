import { Document, parseDocument, visit } from 'yaml';
import { STATUSES, URGENCIES, splitFrontMatter } from './frontmatter.js';
import { demoteH2, findSections } from './sections.js';
import type { Status, Urgency } from './types.js';

export interface MetaValues {
  status: Status;
  urgency: Urgency;
  categories: string[];
  depends_on: string[];
  draft: boolean;
  current_subtask: number | null;
  title: string;
  updated: string;
}
export type MetaKey = keyof MetaValues;

const QUESTION = /^- \[([ xX])\]([ \t]+)(Q\d+)([ \t]*\([^)]*\)[ \t]*:.*)$/;
const ANSWER = /^[ \t]+>[ \t]*answer[ \t]*:/i;
const SUBTASK = /^(- \[)([ xX])(\][ \t]+(\d+)\.[ \t]+.*)$/;

export function detectEol(text: string): '\n' | '\r\n' {
  return /\r\n/.test(text) ? '\r\n' : '\n';
}

/** One line plus its own ending ('' for the final segment). */
interface Line { text: string; eol: string }

function toLines(text: string): Line[] {
  const parts = text.split(/(\r?\n)/);
  const out: Line[] = [];
  for (let i = 0; i < parts.length; i += 2) out.push({ text: parts[i]!, eol: parts[i + 1] ?? '' });
  return out;
}

const fromLines = (ls: Line[]): string => ls.map((l) => l.text + l.eol).join('');
const textsOf = (ls: Line[]): string[] => ls.map((l) => l.text);

/** Ending for a line inserted at `at`: the line before's, else the line after's, else the nearest one. */
function eolNear(ls: Line[], at: number, fallback: string): string {
  if (ls[at - 1]?.eol) return ls[at - 1]!.eol;
  if (ls[at]?.eol) return ls[at]!.eol;
  for (let i = at - 1; i >= 0; i--) if (ls[i]!.eol) return ls[i]!.eol;
  return fallback;
}

/**
 * Replace `del` lines at `start` with `texts`. Replacement lines take the ending of the first line
 * they replace; inserted lines take the ending of the line before (or after). The final segment of
 * the file keeps having no ending.
 */
function spliceLines(ls: Line[], start: number, del: number, texts: string[], fallback: string): void {
  const own = del > 0 ? ls[start]!.eol : '';
  const eol = own || eolNear(ls, start, fallback);
  const atEnd = start + del === ls.length;
  if (start > 0 && ls[start - 1]!.eol === '' && texts.length > 0) ls[start - 1]!.eol = eol;
  const added = texts.map((text) => ({ text, eol }));
  if (atEnd && added.length > 0) added[added.length - 1]!.eol = '';
  ls.splice(start, del, ...added);
}

const TOP_KEY = /^([A-Za-z_][\w-]*)[ \t]*:/;

const isStringArray = (v: unknown): boolean => Array.isArray(v) && v.every((x) => typeof x === 'string');

const VALIDATORS: { [K in MetaKey]: (v: unknown) => boolean } = {
  status: (v) => typeof v === 'string' && (STATUSES as readonly string[]).includes(v),
  urgency: (v) => typeof v === 'string' && (URGENCIES as readonly string[]).includes(v),
  categories: isStringArray,
  depends_on: isStringArray,
  draft: (v) => typeof v === 'boolean',
  current_subtask: (v) => v === null || (typeof v === 'number' && Number.isInteger(v) && v > 0),
  title: (v) => typeof v === 'string' && v.trim() !== '',
  updated: (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v),
};

/** Serialise a single `key: value` entry; arrays use flow style so they stay on one line. */
function serialiseEntry(key: string, value: unknown): string[] {
  const doc = new Document({ [key]: value });
  visit(doc, { Seq: (_k, node) => void (node.flow = true) });
  return doc.toString({ lineWidth: 0, flowCollectionPadding: false }).replace(/\r?\n$/, '').split('\n');
}

/**
 * Set one top-level front matter key. Only that key's own lines (its line plus any indented/list
 * continuation lines) are replaced; every other front matter line stays byte-identical.
 * Throws on an unknown key, an invalid value, or a key written in a form it cannot edit line by line.
 */
export function setMetaField<K extends MetaKey>(text: string, key: K, value: MetaValues[K]): string {
  if (!Object.hasOwn(VALIDATORS, key)) throw new Error(`Invalid key ${String(key)}`);
  if (!VALIDATORS[key](value)) throw new Error(`Invalid value for ${key}`);
  const { yaml, closingLine } = splitFrontMatter(text);
  if (yaml === null || closingLine === null) throw new Error('No front matter');
  const doc = parseDocument(yaml);
  if (doc.errors.length > 0) throw new Error(`Front matter is not valid YAML: ${doc.errors[0]!.message}`);
  const ls = toLines(text);
  const lines = textsOf(ls);
  const closing = closingLine; // lines[0] is the opening ---, lines[closing] the closing ---
  const entry = serialiseEntry(key, value);
  const fallback = detectEol(text);
  let start = -1;
  for (let i = 1; i < closing; i++) {
    const m = TOP_KEY.exec(lines[i]!);
    if (m && m[1] === key) {
      start = i;
      break;
    }
  }
  if (start === -1) {
    if (doc.has(key)) throw new Error(`Cannot edit ${key} safely`);
    spliceLines(ls, closing, 0, entry, fallback);
    return fromLines(ls);
  }
  let end = start + 1;
  while (end < closing && !TOP_KEY.test(lines[end]!)) end++;
  // Blank or column-0 comment lines just before the next key belong to that key, not this one.
  while (end - 1 > start && /^(#.*|[ \t]*)$/.test(lines[end - 1]!)) end--;
  spliceLines(ls, start, end - start, entry, fallback);
  return fromLines(ls);
}

export function setSubtaskDone(text: string, n: number, done: boolean): string {
  const ls = toLines(text);
  const lines = textsOf(ls);
  const range = findSections(lines, splitFrontMatter(text).bodyStartLine).get('subtasks');
  if (range) {
    for (let i = range.start; i < range.end; i++) {
      const m = SUBTASK.exec(lines[i]!);
      if (m && Number(m[4]) === n) {
        ls[i]!.text = `${m[1]}${done ? 'x' : ' '}${m[3]}`;
        return fromLines(ls);
      }
    }
  }
  throw new Error(`Subtask ${n} not found`);
}

export function setAnswers(text: string, answers: Record<string, string>): string {
  const ls = toLines(text);
  const lines = textsOf(ls);
  const range = findSections(lines, splitFrontMatter(text).bodyStartLine).get('open questions');
  const targets: { line: number; id: string }[] = [];
  if (range) {
    for (let i = range.start; i < range.end; i++) {
      const m = QUESTION.exec(lines[i]!);
      if (m && Object.hasOwn(answers, m[3]!)) targets.push({ line: i, id: m[3]! });
    }
  }
  for (const id of Object.keys(answers)) {
    if (!targets.some((t) => t.id === id)) throw new Error(`Question ${id} not found`);
  }
  // Bottom-up so insertions don't shift lines still to be edited.
  for (const { line, id } of targets.reverse()) {
    const value = answers[id]!.replace(/(?:\r?\n)+/g, ' ').trim();
    const m = QUESTION.exec(lines[line]!)!;
    ls[line]!.text = `- [${value === '' ? ' ' : 'x'}]${m[2]}${m[3]}${m[4]}`;
    const answerLine = value === '' ? '  > answer:' : `  > answer: ${value}`;
    const hasAnswer = line + 1 < (range?.end ?? 0) && ANSWER.test(lines[line + 1]!);
    if (hasAnswer) ls[line + 1]!.text = answerLine;
    else if (value !== '') spliceLines(ls, line + 1, 0, [answerLine], detectEol(text));
  }
  return fromLines(ls);
}

/** Replace a section's body. `## ` lines in `newBody` (outside code fences) are demoted to `### `. */
export function replaceSection(text: string, heading: string, newBody: string): string {
  const fallback = detectEol(text);
  const ls = toLines(text);
  const bodyLines = demoteH2(newBody.replace(/^(\r?\n)+|(\r?\n)+$/g, '')).split(/\r?\n/);
  const range = findSections(textsOf(ls), splitFrontMatter(text).bodyStartLine).get(heading.trim().toLowerCase());
  if (!range) {
    const hadTrailingEol = ls.length > 0 && ls[ls.length - 1]!.text === '';
    while (ls.length > 0 && ls[ls.length - 1]!.text === '') ls.pop();
    const empty = ls.length === 0;
    const added = [...(empty ? [] : ['']), `## ${heading.trim()}`, '', ...bodyLines, ...(hadTrailingEol || empty ? [''] : [])];
    spliceLines(ls, ls.length, 0, added, fallback);
    return fromLines(ls);
  }
  const atEof = range.end === ls.length;
  spliceLines(ls, range.start, range.end - range.start, ['', ...bodyLines, ...(atEof && ls[ls.length - 1]!.text !== '' ? [] : [''])], fallback);
  return fromLines(ls);
}
