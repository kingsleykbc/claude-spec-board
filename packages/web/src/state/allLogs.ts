import type { Project, Spec, SubtaskLog } from '@specboard/core';

/** One log entry with the spec and subtask it belongs to, for the all-logs view. */
export interface LogItem {
  at: string;
  specId: string;
  specTitle: string;
  subtask: number;
  subtaskTitle: string;
  text: string;
  /** The log's tokens, on the log's newest entry only. */
  tokens: number | null;
  obsolete: SubtaskLog['obsolete'];
  archived: boolean;
}

const stamp = (at: string) => at.trim().replace('T', ' ');

/** Every log entry of every spec (active and archived), newest first; ties go by spec ID, then subtask. */
export function allLogEntries(project: Pick<Project, 'specs' | 'archived'>): LogItem[] {
  const rows: { item: LogItem; idx: number }[] = [];
  const all: Spec[] = [...project.specs, ...project.archived];
  for (const sp of all) {
    for (const [key, log] of Object.entries(sp.logs ?? {})) {
      const n = log.subtask ?? Number(key);
      const title = sp.subtasks.find((t) => t.n === n)?.title.replace(/^\(you\)\s+/, '') ?? `Subtask ${n}`;
      const entries = log.entries ?? [];
      let newest = -1;
      entries.forEach((e, i) => {
        if (newest < 0 || stamp(e.at ?? '') >= stamp(entries[newest]!.at ?? '')) newest = i;
      });
      entries.forEach((e, i) => {
        rows.push({
          idx: i,
          item: {
            at: e.at ?? '',
            specId: sp.id,
            specTitle: sp.title,
            subtask: n,
            subtaskTitle: title,
            text: e.text,
            tokens: i === newest ? (log.tokens ?? null) : null,
            obsolete: log.obsolete ?? null,
            archived: sp.archived,
          },
        });
      });
    }
  }
  rows.sort((a, b) => {
    const t = stamp(b.item.at).localeCompare(stamp(a.item.at));
    if (t) return t;
    if (a.item.specId === b.item.specId && a.item.subtask === b.item.subtask) return b.idx - a.idx;
    return a.item.specId.localeCompare(b.item.specId, undefined, { numeric: true }) || a.item.subtask - b.item.subtask;
  });
  return rows.map((r) => r.item);
}

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Group (already sorted) items by local calendar day: "Today", "Yesterday", else `YYYY-MM-DD`. */
export function groupByDay(items: LogItem[], today: Date): { label: string; items: LogItem[] }[] {
  const t = ymd(today);
  const y = ymd(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1));
  const out: { label: string; items: LogItem[] }[] = [];
  for (const it of items) {
    const m = /^\d{4}-\d{2}-\d{2}/.exec(it.at.trim());
    const day = m ? m[0] : 'Unknown date';
    const label = day === t ? 'Today' : day === y ? 'Yesterday' : day;
    const last = out[out.length - 1];
    if (last && last.label === label) last.items.push(it);
    else out.push({ label, items: [it] });
  }
  return out;
}

/** Case-insensitive match over the text, spec ID, spec title and subtask title. */
export function filterLogs(items: LogItem[], q: string): LogItem[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return items;
  return items.filter((i) => [i.text, i.specId, i.specTitle, i.subtaskTitle].some((f) => f.toLowerCase().includes(needle)));
}

/** Tokens used across every log of every spec, active and archived. */
export function projectTokens(project: Pick<Project, 'specs' | 'archived'>): number {
  let sum = 0;
  for (const sp of [...project.specs, ...project.archived]) for (const log of Object.values(sp.logs ?? {})) sum += log.tokens ?? 0;
  return sum;
}
