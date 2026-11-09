import { parseSpecMeta, splitFrontMatter } from './frontmatter.js';
import { findSections, type SectionRange } from './sections.js';
import type { Question, QuestionType, SpecDoc, Subtask } from './types.js';

const QUESTION = /^- \[([ xX])\][ \t]+(Q\d+)[ \t]*\(([^)]*)\)[ \t]*:[ \t]*(.*?)[ \t]*$/;
const ANSWER = /^[ \t]+>[ \t]*answer[ \t]*:[ \t]*(.*?)[ \t]*$/i;
/** `(optional yesno)`, before the type so a choice's options stay last. */
const PRIORITY = /^[ \t]*(optional|required)[ \t]+/i;
/** `Text? (recommended: Yes)`. Needs some text before it and a value inside. */
const RECOMMENDED = /^(.*?\S)[ \t]*\(recommended[ \t]*:[ \t]*(.*\S)[ \t]*\)$/i;
const SUBTASK = /^- \[([ xX])\][ \t]+(\d+)\.[ \t]+(.*?)[ \t]*$/;
// Only column-0 list items can be questions or subtasks; indented bullets are free-form detail.
const LIST_ITEM = /^[-*+][ \t]/;
const TYPES: readonly QuestionType[] = ['yesno', 'number', 'text', 'choice'];

function sectionText(lines: string[], range: SectionRange | undefined): string {
  return range ? lines.slice(range.start, range.end).join('\n').trim() : '';
}

function parseQuestions(lines: string[], range: SectionRange | undefined, problems: string[]): Question[] {
  const questions: Question[] = [];
  if (!range) return questions;
  for (let i = range.start; i < range.end; i++) {
    const line = lines[i]!;
    const m = QUESTION.exec(line);
    if (!m) {
      if (LIST_ITEM.test(line)) problems.push(`Unrecognised question line ${i + 1}`);
      continue;
    }
    const id = m[2]!;
    const marker = PRIORITY.exec(m[3]!);
    const required = marker?.[1]?.toLowerCase() !== 'optional';
    const spec = marker ? m[3]!.slice(marker[0].length) : m[3]!;
    const rec = RECOMMENDED.exec(m[4]!);
    const colon = spec.indexOf(':');
    const typeName = (colon === -1 ? spec : spec.slice(0, colon)).trim();
    let type: QuestionType;
    if ((TYPES as readonly string[]).includes(typeName)) type = typeName as QuestionType;
    else {
      type = 'text';
      problems.push(`Unknown question type "${typeName}" on line ${i + 1}`);
    }
    const options =
      type === 'choice' && colon !== -1
        ? spec.slice(colon + 1).split('|').map((o) => o.trim()).filter((o) => o !== '')
        : [];
    const qLine = i;
    let answer: string | null = null;
    if (i + 1 < range.end) {
      const a = ANSWER.exec(lines[i + 1]!);
      if (a) {
        if (a[1]! !== '') answer = a[1]!;
        i++;
      }
    }
    questions.push({ id, type, text: rec ? rec[1]! : m[4]!, options, answer, line: qLine, required, recommendation: rec ? rec[2]! : null });
  }
  return questions;
}

function parseSubtasks(lines: string[], range: SectionRange | undefined, problems: string[]): Subtask[] {
  const subtasks: Subtask[] = [];
  if (!range) return subtasks;
  for (let i = range.start; i < range.end; i++) {
    const line = lines[i]!;
    const m = SUBTASK.exec(line);
    if (!m) {
      if (LIST_ITEM.test(line)) problems.push(`Unrecognised subtask line ${i + 1}`);
      continue;
    }
    subtasks.push({ n: Number(m[2]), title: m[3]!, done: m[1] !== ' ', line: i, hasLog: false });
  }
  return subtasks;
}

/** Parse a spec.md file. Never throws; issues are reported in `problems`. */
export function parseSpec(text: string): SpecDoc {
  const { yaml, bodyStartLine } = splitFrontMatter(text);
  const { meta, problems } = parseSpecMeta(yaml);
  const lines = text.split(/\r?\n/);
  const sections = findSections(lines, bodyStartLine);
  return {
    ...meta,
    specMd: sectionText(lines, sections.get('spec')),
    featuresMd: sectionText(lines, sections.get('features')),
    questions: parseQuestions(lines, sections.get('open questions'), problems),
    subtasks: parseSubtasks(lines, sections.get('subtasks'), problems),
    problems,
  };
}
