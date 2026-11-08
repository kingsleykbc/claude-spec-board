import { Document, parseDocument, visit } from 'yaml';
import { splitFrontMatter } from './frontmatter.js';
import { findSections } from './sections.js';

export type MetaKey =
  | 'status'
  | 'urgency'
  | 'categories'
  | 'depends_on'
  | 'draft'
  | 'current_subtask'
  | 'title'
  | 'updated';

const QUESTION = /^- \[([ xX])\]([ \t]+)(Q\d+)([ \t]*\([^)]*\)[ \t]*:.*)$/;
const ANSWER = /^[ \t]+>[ \t]*answer[ \t]*:/i;
const SUBTASK = /^(- \[)([ xX])(\][ \t]+(\d+)\.[ \t]+.*)$/;

export function detectEol(text: string): '\n' | '\r\n' {
  return /\r\n/.test(text) ? '\r\n' : '\n';
}

const splitLines = (text: string): string[] => text.split(/\r?\n/);

const TOP_KEY = /^([A-Za-z_][\w-]*)[ \t]*:/;

/** Serialise a single `key: value` entry; arrays use flow style so they stay on one line. */
function serialiseEntry(key: string, value: unknown): string[] {
  const doc = new Document({ [key]: value });
  visit(doc, { Seq: (_k, node) => void (node.flow = true) });
  return doc.toString({ lineWidth: 0, flowCollectionPadding: false }).replace(/\r?\n$/, '').split('\n');
}

/**
 * Set one top-level front matter key. Only that key's own lines (its line plus any indented/list
 * continuation lines) are replaced; every other front matter line stays byte-identical.
 */
export function setMetaField(text: string, key: MetaKey, value: unknown): string {
  const { yaml, bodyStartLine } = splitFrontMatter(text);
  if (yaml === null) throw new Error('No front matter');
  const doc = parseDocument(yaml);
  if (doc.errors.length > 0) throw new Error(`Front matter is not valid YAML: ${doc.errors[0]!.message}`);
  const eol = detectEol(text);
  const lines = splitLines(text);
  const closing = bodyStartLine - 1; // lines[0] is the opening ---, lines[closing] the closing ---
  const entry = serialiseEntry(key, value);
  let start = -1;
  for (let i = 1; i < closing; i++) {
    const m = TOP_KEY.exec(lines[i]!);
    if (m && m[1] === key) {
      start = i;
      break;
    }
  }
  if (start === -1) {
    lines.splice(closing, 0, ...entry);
    return lines.join(eol);
  }
  let end = start + 1;
  while (end < closing && !TOP_KEY.test(lines[end]!)) end++;
  // Blank or column-0 comment lines just before the next key belong to that key, not this one.
  while (end - 1 > start && /^(#.*|[ \t]*)$/.test(lines[end - 1]!)) end--;
  lines.splice(start, end - start, ...entry);
  return lines.join(eol);
}

export function setSubtaskDone(text: string, n: number, done: boolean): string {
  const lines = splitLines(text);
  const range = findSections(lines, splitFrontMatter(text).bodyStartLine).get('subtasks');
  if (range) {
    for (let i = range.start; i < range.end; i++) {
      const m = SUBTASK.exec(lines[i]!);
      if (m && Number(m[4]) === n) {
        lines[i] = `${m[1]}${done ? 'x' : ' '}${m[3]}`;
        return lines.join(detectEol(text));
      }
    }
  }
  throw new Error(`Subtask ${n} not found`);
}

export function setAnswers(text: string, answers: Record<string, string>): string {
  const lines = splitLines(text);
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
    lines[line] = `- [${value === '' ? ' ' : 'x'}]${m[2]}${m[3]}${m[4]}`;
    const answerLine = value === '' ? '  > answer:' : `  > answer: ${value}`;
    const hasAnswer = line + 1 < (range?.end ?? 0) && ANSWER.test(lines[line + 1]!);
    if (hasAnswer) lines[line + 1] = answerLine;
    else if (value !== '') lines.splice(line + 1, 0, answerLine);
  }
  return lines.join(detectEol(text));
}

export function replaceSection(text: string, heading: string, newBody: string): string {
  const eol = detectEol(text);
  const lines = splitLines(text);
  const bodyLines = splitLines(newBody.replace(/^(\r?\n)+|(\r?\n)+$/g, ''));
  const range = findSections(lines, splitFrontMatter(text).bodyStartLine).get(heading.trim().toLowerCase());
  if (!range) {
    const hadTrailingEol = lines.length > 0 && lines[lines.length - 1] === '';
    while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
    const added = [...(lines.length > 0 ? [''] : []), `## ${heading.trim()}`, '', ...bodyLines];
    return [...lines, ...added, ...(hadTrailingEol || lines.length === 0 ? [''] : [])].join(eol);
  }
  const atEof = range.end === lines.length;
  const keepEofMarker = atEof && lines[lines.length - 1] === '';
  const replacement = atEof ? ['', ...bodyLines, ...(keepEofMarker ? [''] : [])] : ['', ...bodyLines, ''];
  const tail = keepEofMarker ? [] : lines.slice(range.end);
  return [...lines.slice(0, range.start), ...replacement, ...tail].join(eol);
}
