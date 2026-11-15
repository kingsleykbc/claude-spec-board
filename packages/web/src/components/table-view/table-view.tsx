import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import type { Spec } from '@specboard/core';
import { youStep } from '@specboard/core/you';
import { CaretIcon, CaretRightIcon, CheckIcon } from '@/lib/icons';
import { formatTokens } from '@/lib/formatTokens';
import { tokensUsed } from '@/lib/vm';
import { cn } from '@/lib/utils';
import { filterSpecs, milestoneOptions, NO_FILTERS, orderSpecs, waitingReason, type Filters } from '@/state/filters';
import { CategoryTag } from '@/components/ui/category-tag/category-tag';
import { StatusChip } from '@/components/ui/status-chip/status-chip';
import { Urgency } from '@/components/ui/urgency/urgency';
import { Hint } from '@/components/ui/hint/hint';
import { InfoPopover } from '@/components/ui/info-popover/info-popover';

export interface TableViewProps {
  /** Active specs (unfiltered; the table applies `filters`). */
  specs: Spec[];
  /** Archived specs (unfiltered). */
  archived: Spec[];
  /** Category, urgency and blocked apply; the milestone does not (the table always shows every milestone). */
  filters?: Filters;
  /** The project's milestone list; empty means one table without sections. */
  milestones: string[];
  /** Simple mode: no Urgency or Categories columns. */
  simple: boolean;
  /** Show the Tokens column (the project's `track_tokens` setting). */
  trackTokens?: boolean;
  /** Read-only overview table: ID, Title, Status and Progress only; no subtask rows, no Archived section, titles are plain text. */
  compact?: boolean;
  /** Opens a spec's detail; not needed when `compact`. */
  onOpen?: (id: string) => void;
}

type ColumnKey = 'expand' | 'id' | 'title' | 'status' | 'progress' | 'urgency' | 'categories' | 'tokens';

interface Column {
  key: ColumnKey;
  /** Header text ('Subtasks' is for screen readers only). */
  label: string;
  /** Fixed width in px; null takes the rest of the row (Title). */
  width: number | null;
}

/**
 * The one column template every group table uses (milestones, No milestone, Archived). With `table-fixed`
 * the widths come from the colgroup, not the content, so columns line up from one group to the next.
 * Each mode takes the columns it shows from here, in this order (see `columnsFor`).
 */
export const TABLE_COLUMNS: readonly Column[] = [
  { key: 'expand', label: 'Subtasks', width: 40 },
  { key: 'id', label: 'ID', width: 96 },
  { key: 'title', label: 'Title', width: null },
  { key: 'status', label: 'Status', width: 140 },
  { key: 'progress', label: 'Progress', width: 96 },
  { key: 'urgency', label: 'Urgency', width: 112 },
  { key: 'categories', label: 'Categories', width: 220 },
  { key: 'tokens', label: 'Tokens', width: 96 },
];

/** The compact (overview) table's own column set, shared across its groups the same way. */
const COMPACT_KEYS: readonly ColumnKey[] = ['id', 'title', 'status', 'progress'];

/** The Title column never gets narrower than this; the table scrolls sideways instead. */
const TITLE_MIN = 220;
const TABLE_MIN = 720;

interface Cols {
  simple: boolean;
  trackTokens: boolean;
  compact: boolean;
  onOpen?: (id: string) => void;
}

/** The columns a mode shows, in template order. */
function columnsFor(c: Cols): Column[] {
  return TABLE_COLUMNS.filter((col) => {
    if (c.compact) return COMPACT_KEYS.includes(col.key);
    if (col.key === 'urgency' || col.key === 'categories') return !c.simple;
    if (col.key === 'tokens') return c.trackTokens;
    return true;
  });
}

const th = 'border-b border-line px-2.5 py-2 text-left text-[11.5px] font-semibold whitespace-nowrap text-fg3';
const td = 'border-b border-line px-2.5 py-[7px] align-middle';
const num = 'font-mono text-xs whitespace-nowrap text-fg2';
const youTag = 'inline-block rounded-full bg-review-soft px-1.5 align-[1px] text-[11px] leading-[18px] font-semibold text-review-ink';

function Row({ spec, c, span }: { spec: Spec; c: Cols; span: number }) {
  const [open, setOpen] = useState(false);
  const subId = useId();
  const done = spec.subtasks.filter((t) => t.done).length;
  const tokens = c.trackTokens ? tokensUsed(spec) : null;
  const waiting = waitingReason(spec);
  return (
    <>
      <tr data-testid={`row-${spec.id}`} className="hover:bg-raise">
        {!c.compact && (
          <td className={cn(td, 'pr-0')}>
            <button
              type="button"
              className="inline-flex size-[22px] cursor-pointer items-center justify-center rounded-[5px] border-0 bg-transparent p-0 text-sm text-fg3 hover:bg-line hover:text-fg"
              aria-label={`Subtasks of ${spec.id}`}
              aria-expanded={open}
              aria-controls={subId}
              onClick={() => setOpen((o) => !o)}
            >
              {open ? <CaretIcon aria-hidden /> : <CaretRightIcon aria-hidden />}
            </button>
          </td>
        )}
        <td className={td}>
          <span className="font-mono text-xs whitespace-nowrap text-fg3" data-testid="spec-id">
            {spec.id}
          </span>
        </td>
        <td className={td}>
          {c.compact ? (
            <span className="font-medium text-fg">{spec.title}</span>
          ) : (
            <div className="flex min-w-0 items-center">
              <Hint label={spec.title}>
                <button
                  type="button"
                  className="min-w-0 cursor-pointer truncate border-0 bg-transparent p-0 text-left [font:inherit] font-medium text-fg hover:text-accent-ink hover:underline"
                  onClick={() => c.onOpen?.(spec.id)}
                >
                  {spec.title}
                </button>
              </Hint>
              {waiting !== null && (
                <span className="ml-2 inline-flex flex-none">
                  <InfoPopover label={`Why is ${spec.id} waiting on you?`} title="Waiting on you" trigger={<span className={youTag} title={waiting}>you</span>}>
                    {waiting}
                  </InfoPopover>
                </span>
              )}
            </div>
          )}
        </td>
        <td className={td}>
          <StatusChip status={spec.status} />
        </td>
        <td className={cn(td, num)}>
          {done}/{spec.subtasks.length}
        </td>
        {!c.compact && !c.simple && (
          <>
            <td className={td}>
              <Urgency level={spec.urgency} />
            </td>
            <td className={td}>
              <span className="flex flex-wrap gap-1">
                {spec.categories.map((x) => (
                  <CategoryTag key={x} name={x} />
                ))}
              </span>
            </td>
          </>
        )}
        {!c.compact && c.trackTokens && (
          <td className={cn(td, num)} data-testid="tokens">
            {tokens === null ? '' : formatTokens(tokens)}
          </td>
        )}
      </tr>
      {!c.compact && (
        <tr id={subId} hidden={!open}>
          <td className={cn(td, 'bg-panel')} />
          <td colSpan={span - 1} className={cn(td, 'bg-panel')}>
            {spec.subtasks.length === 0 ? (
              <span className="text-[12.5px] text-fg3">No subtasks.</span>
            ) : (
              <ol className="m-0 flex list-none flex-col gap-1 px-0 py-0.5">
                {spec.subtasks.map((t) => {
                  const you = youStep(t.title);
                  return (
                    <li key={t.n} className="flex items-center gap-2 text-[12.5px] text-fg2">
                      <span className="min-w-5 font-mono text-[11.5px] text-fg3">{t.n}.</span>
                      <span
                        role="img"
                        className="inline-flex size-3.5 items-center justify-center rounded-[4px] border-[1.5px] border-line2 text-[10px] data-[done=true]:border-done data-[done=true]:bg-done data-[done=true]:text-card"
                        data-done={t.done}
                        aria-label={t.done ? 'Done' : 'Not done'}
                      >
                        {t.done && <CheckIcon aria-hidden />}
                      </span>
                      <span>{you ?? t.title}</span>
                      {you !== null && <span className={youTag}>you</span>}
                    </li>
                  );
                })}
              </ol>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

/** One real table of specs, on the shared column template. `empty` is shown in the body when there are no rows. */
function SpecTable({ specs, c, empty }: { specs: Spec[]; c: Cols; empty?: string }) {
  const cols = columnsFor(c);
  const span = cols.length;
  // Wide enough that the Title column keeps TITLE_MIN; narrower windows scroll the table sideways.
  const minWidth = Math.max(TABLE_MIN, cols.reduce((n, col) => n + (col.width ?? TITLE_MIN), 0));
  return (
    <table
      className="w-full table-fixed border-collapse rounded-[10px] border border-line bg-card text-[13px]"
      // Computed from TABLE_COLUMNS for this mode.
      style={{ minWidth }}
    >
      <colgroup>
        {cols.map((col) => (
          <col key={col.key} data-col={col.key} style={col.width === null ? undefined : { width: col.width }} />
        ))}
      </colgroup>
      <thead>
        <tr>
          {cols.map((col) => (
            <th key={col.key} scope="col" className={cn(th, col.key === 'expand' && 'pr-0')}>
              {col.key === 'expand' ? <span className="sr-only">{col.label}</span> : col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {orderSpecs(specs).map((x) => (
          <Row key={x.id} spec={x} c={c} span={span} />
        ))}
        {specs.length === 0 && empty && (
          <tr>
            <td colSpan={span} className={cn(td, 'text-[12.5px] text-fg3')}>
              {empty}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

/** A collapsible section: a heading button with aria-expanded, then its table. */
function Section({ title, initiallyOpen, children }: { title: string; initiallyOpen: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(initiallyOpen);
  const id = useId();
  return (
    <section className="mb-3.5">
      <h3 className="m-0 mb-1.5 text-[13px] font-semibold">
        <button
          type="button"
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border-0 bg-transparent px-1.5 py-1 [font:inherit] text-fg hover:bg-panel"
          aria-expanded={open}
          aria-controls={id}
          data-section=""
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <CaretIcon aria-hidden className="text-[13px] text-fg3" /> : <CaretRightIcon aria-hidden className="text-[13px] text-fg3" />}
          {title}
        </button>
      </h3>
      <div id={id} hidden={!open}>
        {open && children}
      </div>
    </section>
  );
}

/** Every spec as rows (design sections 7-8): by milestone, then status, then the board's order. Archived last, closed. */
export function TableView({
  specs: allSpecs,
  archived: allArchived,
  filters = NO_FILTERS,
  milestones,
  simple,
  trackTokens = false,
  compact = false,
  onOpen,
}: TableViewProps) {
  const c: Cols = { simple, trackTokens, compact, onOpen };
  if (allSpecs.length + allArchived.length === 0) {
    return <div className="px-5 py-6 text-fg3">No specs yet.</div>;
  }
  const shown = { ...filters, milestone: null };
  const specs = filterSpecs(allSpecs, shown);
  const archived = filterSpecs(allArchived, shown);
  if (specs.length + archived.length === 0) {
    return <div className="px-5 py-6 text-fg3">No specs match the filters.</div>;
  }
  return (
    <div className="overflow-x-auto px-5 pb-[100px]" data-testid="table-scroll">
      {milestones.length > 0 ? (
        milestoneOptions(specs, archived, milestones).map((o) => (
          <Section key={o.value} title={`${o.label} · ${o.done}/${o.total}`} initiallyOpen>
            <SpecTable
              specs={filterSpecs(specs, { ...NO_FILTERS, milestone: o.value }, milestones)}
              c={c}
              empty={o.total === 0 ? 'No specs in this milestone yet.' : undefined}
            />
          </Section>
        ))
      ) : (
        <SpecTable specs={specs} c={c} />
      )}
      {!compact && archived.length > 0 && (
        <Section title={`Archived · ${archived.length}`} initiallyOpen={false}>
          <SpecTable specs={archived} c={c} />
        </Section>
      )}
    </div>
  );
}
