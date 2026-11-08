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
 * Set one top-level front matter key, without key/value validation. Only that key's own lines (its
 * line plus any indented/list continuation lines) are replaced; every other front matter line stays
 * byte-identical. Throws on missing front matter, invalid YAML, or a key written in a form it
 * cannot edit line by line.
 */
export function setTopLevelKey(text: string, key: string, value: unknown): string {
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

/** Set one spec front matter field. Throws on an unknown key or an invalid value. */
export function setMetaField<K extends MetaKey>(text: string, key: K, value: MetaValues[K]): string {
  if (!Object.hasOwn(VALIDATORS, key)) throw new Error(`Invalid key ${String(key)}`);
  if (!VALIDATORS[key](value)) throw new Error(`Invalid value for ${key}`);
  return setTopLevelKey(text, key, value);
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

// ---- Spec body: everything except front matter, the Spec heading, Open questions and Subtasks ----

const FENCE_LINE = /^[ \t]*(```|~~~)/;
const KEPT_HEADING = /^##[ \t]+(open questions|subtasks)[ \t]*#*[ \t]*$/i;
const HEADING_LINE = /^##[ \t]+(.+?)[ \t]*#*[ \t]*$/;
const isBlank = (l: Line): boolean => l.text.trim() === '';

/** Demote `## Open questions` / `## Subtasks` headings (outside code fences) to `###`. */
function demoteKeptHeadings(md: string): string {
  const parts = md.split(/(\r?\n)/);
  let fence: string | null = null;
  for (let i = 0; i < parts.length; i += 2) {
    const f = FENCE_LINE.exec(parts[i]!);
    if (f) {
      if (fence === null) fence = f[1]!;
      else if (fence === f[1]) fence = null;
      continue;
    }
    if (fence === null && KEPT_HEADING.test(parts[i]!)) parts[i] = `#${parts[i]}`;
  }
  return parts.join('');
}

interface BodySplit {
  /** All lines, without the empty segment after a final line ending. */
  ls: Line[];
  /** Leading lines that are never edited: front matter, then the Spec heading and its blank lines. */
  headEnd: number;
  /** Free (editable) lines up to the end of the last kept block. */
  a: Line[];
  /** The kept Open questions / Subtasks blocks, in file order. */
  kept: Line[];
  /** Free lines after the last kept block; they start at a `## ` heading. */
  b: Line[];
  /** Lowercase heading text of b's first line, if any. */
  anchor: string | null;
  endsNl: boolean;
}

function splitBody(text: string): BodySplit {
  let ls = toLines(text);
  const endsNl = ls.length > 1 && ls[ls.length - 1]!.text === '';
  if (endsNl) ls = ls.slice(0, -1);
  const bodyStart = Math.min(splitFrontMatter(text).bodyStartLine, ls.length);
  const sections = findSections(textsOf(ls), bodyStart);
  const ranges = ['open questions', 'subtasks']
    .map((k) => sections.get(k))
    .filter((r): r is NonNullable<typeof r> => r !== undefined)
    .sort((x, y) => x.headingLine - y.headingLine);
  const kept: Line[] = [];
  const inKept = new Set<number>();
  for (const r of ranges) {
    for (let i = r.headingLine; i < r.end; i++) {
      kept.push(ls[i]!);
      inKept.add(i);
    }
  }
  const lastEnd = ranges.length > 0 ? ranges[ranges.length - 1]!.end : ls.length;
  const firstKept = ranges.length > 0 ? ranges[0]!.headingLine : ls.length;

  // Head: blank lines, the Spec heading and the blank lines after it (only when the heading comes first).
  let headEnd = bodyStart;
  const spec = sections.get('spec');
  if (spec && spec.headingLine < firstKept && ls.slice(bodyStart, spec.headingLine).every(isBlank)) {
    headEnd = spec.headingLine + 1;
  }
  while (headEnd < firstKept && isBlank(ls[headEnd]!)) headEnd++;

  const a: Line[] = [];
  const b: Line[] = [];
  for (let i = headEnd; i < ls.length; i++) {
    if (inKept.has(i)) continue;
    (i < lastEnd ? a : b).push(ls[i]!);
  }
  const m = b.length > 0 ? HEADING_LINE.exec(b[0]!.text) : null;
  return { ls, headEnd, a, kept, b, anchor: m ? m[1]!.trim().toLowerCase() : null, endsNl };
}

function trimTrailingBlank(ls: Line[]): Line[] {
  let n = ls.length;
  while (n > 0 && isBlank(ls[n - 1]!)) n--;
  return ls.slice(0, n);
}

/**
 * The editable body of a spec: everything after the front matter except the `## Spec` heading line
 * and the `## Open questions` / `## Subtasks` sections. Other sections keep their headings.
 * Leading and trailing blank lines are dropped.
 */
export function specBodyMd(text: string): string {
  const s = splitBody(text);
  const a = trimTrailingBlank(s.a);
  const b = trimTrailingBlank(s.b);
  const sep: Line[] = a.length > 0 && b.length > 0 ? [{ text: '', eol: a[a.length - 1]!.eol || detectEol(text) }] : [];
  const all = [...a, ...sep, ...b];
  return all.map((l, i) => l.text + (i === all.length - 1 ? '' : l.eol)).join('');
}

/**
 * Replace the spec body (what `specBodyMd` returns). Front matter, the Spec heading, and the
 * Open questions and Subtasks sections stay byte-for-byte. `## Open questions` / `## Subtasks`
 * headings inside `md` become `###`. Sections that followed the kept blocks in the file (for example
 * Notes) stay after them when `md` still has that heading; everything else goes before them.
 * Line endings in `md` follow the file's.
 */
export function replaceSpecBody(text: string, md: string): string {
  if (md === specBodyMd(text)) return text;
  const eol = detectEol(text);
  const s = splitBody(text);
  const normalised = demoteKeptHeadings(md.replace(/\r?\n/g, eol)).replace(/^(?:[ \t]*\r?\n)+/, '');
  const mdLines = toLines(normalised);
  for (const l of mdLines) if (l.eol === '') l.eol = eol;
  let aPart = mdLines;
  let bPart: Line[] = [];
  if (s.anchor !== null) {
    const k = findSections(textsOf(mdLines), 0).get(s.anchor);
    if (k) {
      aPart = mdLines.slice(0, k.headingLine);
      bPart = mdLines.slice(k.headingLine);
    }
  }
  aPart = trimTrailingBlank(aPart);
  bPart = trimTrailingBlank(bPart);
  const out: Line[] = [...s.ls.slice(0, s.headEnd), ...aPart];
  if (aPart.length > 0 && s.kept.length > 0) out.push({ text: '', eol });
  out.push(...s.kept, ...bPart);
  const last = out[out.length - 1];
  if (last) last.eol = s.endsNl ? last.eol || eol : '';
  return fromLines(out);
}
