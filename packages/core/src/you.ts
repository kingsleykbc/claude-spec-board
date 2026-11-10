const YOU_PREFIX = /^\(you\)\s+(\S.*)$/i;

/** The step text when a subtask title is a person-only `(you)` step; otherwise null. */
export function youStep(title: string): string | null {
  const rest = YOU_PREFIX.exec(title.trim())?.[1];
  return rest === undefined ? null : rest.trim();
}

/** `youStep` of the first unticked subtask, or null when none is open or it is Claude's. */
export function firstOpenYouStep(subtasks: { done: boolean; title: string }[]): string | null {
  const open = subtasks.find((s) => !s.done);
  return open ? youStep(open.title) : null;
}
