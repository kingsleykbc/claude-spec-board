import type { Question, Spec, Urgency } from '@specboard/core';
import { groupByMilestone, milestoneOf } from '@specboard/core/milestones';
import { firstOpenYouStep } from '@specboard/core/you';
import { ORDER, URG } from '../lib/vm';

// Board filters, sort and "waiting" items (pinned behaviours 1, 3, 4), copied from the prototype's renderVals.

/** The milestone filter's value for specs with no (or an unknown) milestone. */
export const NO_MILESTONE = '\u0000none';

export interface Filters {
  cats: string[];
  urg: Urgency[];
  blocked: boolean;
  /** The board shows only this milestone (a listed name or `NO_MILESTONE`); null = all. The table ignores it. */
  milestone: string | null;
}
export const NO_FILTERS: Filters = { cats: [], urg: [], blocked: false, milestone: null };

/**
 * Category and Urgency combine with AND across groups and OR within a group; Blocked only is a switch.
 * The milestone applies only when the project's milestone list is given.
 */
export function filterSpecs(specs: Spec[], f: Filters, milestones: string[] = []): Spec[] {
  const ms = milestones.length > 0 && f.milestone !== null ? f.milestone : undefined;
  return specs.filter(
    (s) =>
      (f.cats.length === 0 || s.categories.some((c) => f.cats.includes(c))) &&
      (f.urg.length === 0 || f.urg.includes(s.urgency)) &&
      (!f.blocked || s.blocked) &&
      (ms === undefined || (milestoneOf(s, milestones) ?? NO_MILESTONE) === ms),
  );
}

export interface MilestoneOption {
  /** A listed milestone name, or `NO_MILESTONE`. */
  value: string;
  label: string;
  done: number;
  total: number;
}

/** Done/total over specs, archived ones counted as done (like the project progress). */
function doneTotal(live: Spec[], archived: Spec[]): { done: number; total: number } {
  return { done: live.filter((s) => s.status === 'done').length + archived.length, total: live.length + archived.length };
}

/** Each listed milestone with done/total (archived counted done), then "No milestone" when any spec has none. */
export function milestoneOptions(live: Spec[], archived: Spec[], milestones: string[]): MilestoneOption[] {
  if (milestones.length === 0) return [];
  const arch = new Set(archived);
  return groupByMilestone([...live, ...archived], milestones).map((g) => ({
    value: g.name ?? NO_MILESTONE,
    label: g.name ?? 'No milestone',
    ...doneTotal(
      g.specs.filter((s) => !arch.has(s)),
      g.specs.filter((s) => arch.has(s)),
    ),
  }));
}

/** Urgency (urgent, high, normal, low), then numeric ID. */
export function compareSpecs(a: Spec, b: Spec): number {
  return URG[a.urgency].r - URG[b.urgency].r || a.id.localeCompare(b.id, undefined, { numeric: true });
}

/** A sorted copy. */
export function sortSpecs(specs: Spec[]): Spec[] {
  return [...specs].sort(compareSpecs);
}

/** Status order (to-do, doing, review, done), then the board's order within a status. Shared by the table and the export. */
export function orderSpecs(specs: Spec[]): Spec[] {
  return ORDER.flatMap((st) => sortSpecs(specs.filter((x) => x.status === st)));
}

/** The board's milestone: the chosen one while it is still an option (or null, all), else `fallback` (the current milestone). */
export function effectiveMilestone(chosen: string | null, options: MilestoneOption[], fallback: string | null): string | null {
  if (chosen === null || options.length === 0 || options.some((o) => o.value === chosen)) return chosen;
  return fallback;
}

/** The questions waiting on the person. An unanswered optional one isn't: Claude goes with its recommendation. */
export function openQuestions(s: Spec): Question[] {
  return s.questions.filter((q) => q.required && (q.answer === null || q.answer === ''));
}

/**
 * Why the spec is waiting on the person, or null: it is in Review, has open required questions,
 * or its first open subtask is a `(you)` step. The table's "you" marker shows this as its title.
 */
export function waitingReason(s: Spec): string | null {
  if (s.status === 'review') return 'Waiting on your review';
  const q = openQuestions(s).length;
  if (q > 0) return `${q} question${q > 1 ? 's' : ''} for you`;
  const step = firstOpenYouStep(s.subtasks);
  return step === null ? null : `Your step: ${step}`;
}

export interface WaitItem {
  kind: 'review' | 'questions' | 'blocked';
  text: string;
  /** The spec to open (review, questions); null for blocked, which toggles the filter. */
  target: string | null;
}

/** "<n> to review", "<n> question(s) for you", "<n> blocked"; each hidden when 0. Archived specs are ignored. */
export function waitItems(specs: Spec[]): WaitItem[] {
  const live = specs.filter((s) => !s.archived);
  const review = live.filter((s) => s.status === 'review');
  const qN = live.reduce((n, s) => n + openQuestions(s).length, 0);
  const firstQ = live.find((s) => openQuestions(s).length > 0);
  const blockedN = live.filter((s) => s.status !== 'done' && s.blocked).length;
  const out: WaitItem[] = [];
  if (review.length) out.push({ kind: 'review', text: `${review.length} to review`, target: review[0]!.id });
  if (qN) out.push({ kind: 'questions', text: `${qN} question${qN > 1 ? 's' : ''} for you`, target: firstQ?.id ?? null });
  if (blockedN) out.push({ kind: 'blocked', text: `${blockedN} blocked`, target: null });
  return out;
}

/** Every category in the project (first-seen order), with how many live specs carry it. */
export function categoryOptions(live: Spec[], archived: Spec[]): { name: string; n: number }[] {
  const names = [...new Set([...live, ...archived].flatMap((s) => s.categories))];
  return names.map((name) => ({ name, n: live.filter((s) => s.categories.includes(name)).length }));
}

export interface FilterChip {
  prefix: string;
  label: string;
  /** The filters with this chip removed. */
  without: Filters;
}

export function filterChips(f: Filters): FilterChip[] {
  return [
    ...f.cats.map((c) => ({ prefix: 'Category', label: c, without: { ...f, cats: f.cats.filter((y) => y !== c) } })),
    ...f.urg.map((u) => ({ prefix: 'Urgency', label: URG[u].label, without: { ...f, urg: f.urg.filter((y) => y !== u) } })),
    ...(f.blocked ? [{ prefix: '', label: 'Blocked only', without: { ...f, blocked: false } }] : []),
  ];
}

export function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}
