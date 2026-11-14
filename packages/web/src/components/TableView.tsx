import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import type { Spec } from '@specboard/core';
import { youStep } from '@specboard/core/you';
import { CaretIcon, CaretRightIcon, CheckIcon } from '../lib/icons';
import { formatTokens } from '../lib/formatTokens';
import { ORDER, tokensUsed } from '../lib/vm';
import { filterSpecs, milestoneOptions, NO_FILTERS, sortSpecs, waitingReason, type Filters } from '../state/filters';
import { CategoryTag } from './CategoryTag';
import { StatusChip } from './StatusChip';
import { Urgency } from './Urgency';
import s from './TableView.module.css';

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
  onOpen: (id: string) => void;
}

interface Cols {
  simple: boolean;
  trackTokens: boolean;
  onOpen: (id: string) => void;
}

/** Status order (to-do, doing, review, done), then the board's order within a status. */
function ordered(specs: Spec[]): Spec[] {
  return ORDER.flatMap((st) => sortSpecs(specs.filter((x) => x.status === st)));
}

function Row({ spec, c, span }: { spec: Spec; c: Cols; span: number }) {
  const [open, setOpen] = useState(false);
  const subId = useId();
  const done = spec.subtasks.filter((t) => t.done).length;
  const tokens = c.trackTokens ? tokensUsed(spec) : null;
  const waiting = waitingReason(spec);
  return (
    <>
      <tr data-testid={`row-${spec.id}`} className={s.row}>
        <td className={s.expandCell}>
          <button
            type="button"
            className={s.expand}
            aria-label={`Subtasks of ${spec.id}`}
            aria-expanded={open}
            aria-controls={subId}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <CaretIcon aria-hidden /> : <CaretRightIcon aria-hidden />}
          </button>
        </td>
        <td>
          <span className={s.id} data-testid="spec-id">
            {spec.id}
          </span>
        </td>
        <td className={s.titleCell}>
          <button type="button" className={s.title} onClick={() => c.onOpen(spec.id)}>
            {spec.title}
          </button>
          {waiting !== null && (
            <span className={s.you} title={waiting}>
              you
            </span>
          )}
        </td>
        <td>
          <StatusChip status={spec.status} />
        </td>
        <td className={s.num}>
          {done}/{spec.subtasks.length}
        </td>
        {!c.simple && (
          <>
            <td>
              <Urgency level={spec.urgency} />
            </td>
            <td>
              <span className={s.cats}>
                {spec.categories.map((x) => (
                  <CategoryTag key={x} name={x} />
                ))}
              </span>
            </td>
          </>
        )}
        {c.trackTokens && (
          <td className={s.num} data-testid="tokens">
            {tokens === null ? '' : formatTokens(tokens)}
          </td>
        )}
      </tr>
      <tr id={subId} className={s.subRow} hidden={!open}>
        <td />
        <td colSpan={span - 1}>
          {spec.subtasks.length === 0 ? (
            <span className={s.muted}>No subtasks.</span>
          ) : (
            <ol className={s.subs}>
              {spec.subtasks.map((t) => {
                const you = youStep(t.title);
                return (
                  <li key={t.n} className={s.sub}>
                    <span className={s.subN}>{t.n}.</span>
                    <span role="img" className={s.tick} data-done={t.done} aria-label={t.done ? 'Done' : 'Not done'}>
                      {t.done && <CheckIcon aria-hidden />}
                    </span>
                    <span>{you ?? t.title}</span>
                    {you !== null && <span className={s.you}>you</span>}
                  </li>
                );
              })}
            </ol>
          )}
        </td>
      </tr>
    </>
  );
}

/** One real table of specs. `empty` is shown in the body when there are no rows. */
function SpecTable({ specs, c, empty }: { specs: Spec[]; c: Cols; empty?: string }) {
  const span = 5 + (c.simple ? 0 : 2) + (c.trackTokens ? 1 : 0);
  return (
    <table className={s.table}>
      <thead>
        <tr>
          <th scope="col" className={s.expandCell}>
            <span className={s.srOnly}>Subtasks</span>
          </th>
          <th scope="col">ID</th>
          <th scope="col">Title</th>
          <th scope="col">Status</th>
          <th scope="col">Progress</th>
          {!c.simple && (
            <>
              <th scope="col">Urgency</th>
              <th scope="col">Categories</th>
            </>
          )}
          {c.trackTokens && <th scope="col">Tokens</th>}
        </tr>
      </thead>
      <tbody>
        {ordered(specs).map((x) => (
          <Row key={x.id} spec={x} c={c} span={span} />
        ))}
        {specs.length === 0 && empty && (
          <tr>
            <td colSpan={span} className={s.muted}>
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
    <section className={s.section}>
      <h3 className={s.heading}>
        <button type="button" className={s.headBtn} aria-expanded={open} aria-controls={id} data-section="" onClick={() => setOpen((o) => !o)}>
          {open ? <CaretIcon aria-hidden className={s.caret} /> : <CaretRightIcon aria-hidden className={s.caret} />}
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
export function TableView({ specs: allSpecs, archived: allArchived, filters = NO_FILTERS, milestones, simple, trackTokens = false, onOpen }: TableViewProps) {
  const c: Cols = { simple, trackTokens, onOpen };
  if (allSpecs.length + allArchived.length === 0) {
    return <div className={s.none}>No specs yet.</div>;
  }
  const shown = { ...filters, milestone: null };
  const specs = filterSpecs(allSpecs, shown);
  const archived = filterSpecs(allArchived, shown);
  if (specs.length + archived.length === 0) {
    return <div className={s.none}>No specs match the filters.</div>;
  }
  return (
    <div className={s.scroll} data-testid="table-scroll">
      {milestones.length > 0 ? (
        milestoneOptions(specs, archived, milestones).map((o) => (
          <Section key={o.value} title={`${o.label} · ${o.done}/${o.total}`} initiallyOpen>
            <SpecTable specs={filterSpecs(specs, { ...NO_FILTERS, milestone: o.value }, milestones)} c={c} empty={o.total === 0 ? 'No specs in this milestone yet.' : undefined} />
          </Section>
        ))
      ) : (
        <SpecTable specs={specs} c={c} />
      )}
      {archived.length > 0 && (
        <Section title={`Archived · ${archived.length}`} initiallyOpen={false}>
          <SpecTable specs={archived} c={c} />
        </Section>
      )}
    </div>
  );
}
