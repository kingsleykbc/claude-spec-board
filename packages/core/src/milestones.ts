// Browser-safe: no Node imports (used by the web app via `@specboard/core/milestones`).

export function hasMilestones(config: { milestones: string[] } | null): boolean {
  return config !== null && config.milestones.length > 0;
}

/** The spec's milestone when it is one of the listed ones (exact match after trim), else null. */
export function milestoneOf(spec: { milestone: string | null }, milestones: string[]): string | null {
  const m = spec.milestone?.trim();
  return m !== undefined && m !== '' && milestones.includes(m) ? m : null;
}

/** One group per listed milestone in order (empty ones kept), then a null-named group if any spec has none. */
export function groupByMilestone<T extends { milestone: string | null }>(specs: T[], milestones: string[]): { name: string | null; specs: T[] }[] {
  const groups: { name: string | null; specs: T[] }[] = milestones.map((name) => ({ name, specs: [] }));
  const none: T[] = [];
  for (const spec of specs) {
    const m = milestoneOf(spec, milestones);
    const group = m === null ? undefined : groups.find((g) => g.name === m);
    (group ? group.specs : none).push(spec);
  }
  if (none.length > 0) groups.push({ name: null, specs: none });
  return groups;
}

type Countable = { status: string; archived?: boolean };

/** True when the spec counts toward progress at all: an archived spec counts only if it is done. */
export function countsInProgress(spec: Countable): boolean {
  return spec.archived !== true || spec.status === 'done';
}

/** True when the spec counts as done: status `done` (archived or not). */
export function countsAsDone(spec: Countable): boolean {
  return spec.status === 'done';
}

/** Done and total over active plus archived specs; an archived spec that is not done leaves both counts. */
export function projectProgress(specs: Countable[], archived: Countable[] = []): { done: number; total: number } {
  const counted = [...specs, ...archived.map((s) => ({ ...s, archived: true }))].filter(countsInProgress);
  return { done: counted.filter(countsAsDone).length, total: counted.length };
}

/** First milestone with a counted spec that is not done; all done means the last; no milestones means null. */
export function currentMilestone(specs: { milestone: string | null; status: string; archived?: boolean }[], milestones: string[]): string | null {
  if (milestones.length === 0) return null;
  for (const name of milestones) {
    if (specs.some((s) => countsInProgress(s) && milestoneOf(s, milestones) === name && !countsAsDone(s))) return name;
  }
  return milestones[milestones.length - 1]!;
}
