import type { DragEvent, HTMLAttributes, KeyboardEvent, MouseEvent, PointerEvent, ReactNode } from 'react';
import type { Spec } from '@specboard/core';
import { MoreIcon, NeededByIcon, NeedsIcon, PlayIcon, ReviewIcon, WarnIcon } from '@/lib/icons';
import { firstParagraph, statusMeta } from '@/lib/vm';
import { cn } from '@/lib/utils';
import { useSimple } from '@/state/simpleMode';
import { CategoryTag } from '@/components/ui/category-tag/category-tag';
import { Urgency } from '@/components/ui/urgency/urgency';
import { InlineMarkdown } from '@/components/ui/inline-markdown/inline-markdown';
import { Hint } from '@/components/ui/hint/hint';
import { InfoPopover } from '@/components/ui/info-popover/info-popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip/tooltip';
import { ResponsiveMenu, ResponsiveMenuItem, ResponsiveMenuSeparator } from '@/components/ui/responsive-menu/responsive-menu';

export interface SpecCardProps {
  spec: Spec;
  /** Every spec on the board; used to look up dependency status and titles. */
  all: Spec[];
  /** Name of the subtask Claude is working on ('' when unknown); null or undefined when Claude is not running this spec. */
  running?: string | null;
  /** Claude is writing this draft up. */
  writing?: boolean;
  /** Brief highlight after the spec changed. */
  flash?: boolean;
  dragging?: boolean;
  /** Held in the air by a drag (tilted, large shadow). */
  lifted?: boolean;
  /** Show the hover look (component sheet). */
  forceHover?: boolean;
  onOpen: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onWriteUp: () => void;
  /** Native HTML5 drag: the card is `draggable` only when one of these is passed. */
  onDragStart?: () => void;
  onDragEnd?: () => void;
  /** Ref and listeners/attributes from a drag library (dnd-kit's `useDraggable`), put on the card's root. */
  dragRef?: (el: HTMLElement | null) => void;
  dragProps?: HTMLAttributes<HTMLDivElement>;
}

/** Marks a control inside the card (an info popover) that a press must not turn into a drag or an open. */
const CONTROL = 'data-card-control';

/** One labelled row in the Simple mode ⋯ menu. */
function Detail({ label, ink, children }: { label: string; ink?: string; children: ReactNode }) {
  return (
    <span className="flex flex-col gap-[3px]">
      <span className={cn('text-[11px] font-semibold tracking-[0.04em] text-fg3 uppercase', ink)}>{label}</span>
      <span className="flex flex-wrap items-center gap-[5px] text-[12.5px] leading-[1.4] whitespace-normal text-fg">{children}</span>
    </span>
  );
}

/**
 * An indicator that explains itself in a popover. Its clicks (the popover is portalled, but React still bubbles
 * its events through the card) stop here, so they never open the card.
 */
function CardInfo({ label, title, trigger, children }: { label: string; title: string; trigger: ReactNode; children: ReactNode }) {
  return (
    <span {...{ [CONTROL]: '' }} className="inline-flex" onClick={(e) => e.stopPropagation()}>
      <InfoPopover label={label} title={title} trigger={trigger}>
        {children}
      </InfoPopover>
    </span>
  );
}

const stop = (fn?: () => void) => (e: MouseEvent) => {
  e.stopPropagation();
  fn?.();
};

/** A press that starts outside the card's own DOM (a portalled popover) or on one of its info controls. */
const notTheCard = (e: { target: EventTarget; currentTarget: Element }) => {
  const t = e.target as Element;
  return !e.currentTarget.contains(t) || t.closest(`[${CONTROL}]`) !== null;
};

function Pulse() {
  return <span className="inline-block size-[7px] flex-none animate-sb-pulse rounded-full bg-current" />;
}

const badge = 'inline-flex items-center gap-1 rounded-[5px] px-[7px] py-0.5 text-[11px] font-semibold';
const banner = 'flex items-center gap-[7px] rounded-[7px] px-2 py-1.5 text-xs font-medium';

export function SpecCard({
  spec,
  all,
  running,
  writing = false,
  flash = false,
  dragging = false,
  lifted = false,
  forceHover = false,
  onOpen,
  onArchive,
  onUnarchive,
  onWriteUp,
  onDragStart,
  onDragEnd,
  dragRef,
  dragProps,
}: SpecCardProps) {
  const simple = useSimple();
  const { subtasks } = spec;
  const total = subtasks.length;
  const done = subtasks.filter((t) => t.done).length;
  const pct = total ? Math.round((done / total) * 100) + '%' : '0%';
  const complete = total > 0 && done === total;

  const find = (id: string) => all.find((x) => x.id === id);
  const needs = spec.dependsOn;
  const neededBy = spec.dependents;
  const depItem = (id: string) => {
    const d = find(id);
    const open = !d || d.status !== 'done';
    return { id, open, className: open ? 'font-semibold text-block-ink' : 'text-fg3' };
  };
  const anyNeedOpen = needs.some((id) => depItem(id).open);
  const depTip = [
    needs.length
      ? 'Needs: ' +
        needs
          .map((id) => {
            const d = find(id);
            return d ? `${id} ${d.title} (${statusMeta(d.status).label})` : id;
          })
          .join(', ')
      : null,
    neededBy.length
      ? 'Needed by: ' +
        neededBy
          .map((id) => {
            const d = find(id);
            return d ? `${id} ${d.title}` : id;
          })
          .join(', ')
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const isDraft = spec.draft && !writing;
  const isRunning = running !== null && running !== undefined;
  const fileProblem = spec.problems[0];
  /** Simple mode hides these, so the ⋯ button carries a dot to say something needs a look. */
  const attention = spec.blocked || fileProblem !== undefined;
  const showMenu = simple || spec.status === 'done';
  const menuLabel = simple ? `More about ${spec.id}` : 'Card actions';

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    // Keys on an info control, or in its portalled popover, belong to it: no pick-up, no open.
    if (notTheCard(e)) return;
    // A drag library may claim the key first (dnd-kit picks up on Space).
    dragProps?.onKeyDown?.(e);
    if (e.defaultPrevented) return;
    // During a keyboard drag, Space/Enter ends it. dnd-kit handles that on document, after this
    // (React root) handler, so `dragging` is still true here: don't open the card as well.
    if (dragging) return;
    if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
      e.preventDefault();
      onOpen();
    }
  };
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    // A press on an info control (or in its popover) never starts a drag.
    if (notTheCard(e)) return;
    dragProps?.onPointerDown?.(e);
  };
  const dragStart = (e: DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('text/plain', spec.id);
    e.dataTransfer.effectAllowed = 'move';
    onDragStart?.();
  };

  return (
    <div
      {...dragProps}
      ref={dragRef}
      role="button"
      tabIndex={0}
      aria-label={`${spec.id} ${spec.title}`}
      data-flash={(flash && !forceHover) || undefined}
      data-lifted={lifted || undefined}
      draggable={onDragStart !== undefined || onDragEnd !== undefined}
      onDragStart={dragStart}
      onDragEnd={() => onDragEnd?.()}
      onClick={onOpen}
      onKeyDown={onKey}
      onPointerDown={onPointerDown}
      className={cn(
        'relative flex cursor-pointer flex-col gap-[9px] rounded-[10px] border px-[13px] pt-3 pb-[11px] font-sans text-fg',
        '[transition:background_.15s,border-color_.15s,box-shadow_.6s,opacity_.15s]',
        forceHover
          ? 'border-line2 bg-raise'
          : flash
            ? 'border-accent bg-accent-soft'
            : 'border-line bg-card hover:border-line2 hover:bg-raise',
        lifted
          ? 'rotate-[-1.8deg] shadow-[0_18px_40px_oklch(0.2_0.01_60/.22)]'
          : flash && !forceHover
            ? 'shadow-[0_0_0_3px_var(--accent-soft)]'
            : 'shadow-[0_1px_1.5px_oklch(0.2_0.01_60/.05)]',
        dragging ? 'opacity-40' : spec.archived ? 'opacity-[0.62]' : null,
      )}
    >
      <div className="flex min-h-5 items-center gap-1.5">
        <span className="font-mono text-[11.5px] tracking-[0.02em] text-fg3">{spec.id}</span>
        {isDraft && <span className="rounded-[5px] border border-dashed border-line2 px-[7px] py-px text-[11px] font-semibold text-fg2">Draft</span>}
        {spec.archived && <span className="text-[11px] text-fg3">· Archived</span>}
        <span className="flex-1" />
        {!simple && fileProblem !== undefined && (
          <CardInfo
            label={`What is wrong with the ${spec.id} file?`}
            title="File problem"
            trigger={
              <span className={cn(badge, 'bg-review-soft text-review-ink')}>
                <WarnIcon aria-hidden /> File problem
              </span>
            }
          >
            {fileProblem}
          </CardInfo>
        )}
        {!simple && spec.blocked && (
          <CardInfo
            label={`Why is ${spec.id} blocked?`}
            title="Blocked"
            trigger={
              <span className={cn(badge, 'bg-block-soft text-block-ink')}>
                <span className="font-bold">!</span>Blocked
              </span>
            }
          >
            {spec.blockedReasons.join(' · ')}
          </CardInfo>
        )}
        {showMenu && (
          // A control of its own: pressing it (or anything in its portalled menu or drawer) never drags or opens the card.
          <span {...{ [CONTROL]: '' }} className="inline-flex" onClick={(e) => e.stopPropagation()}>
            <ResponsiveMenu
              title={menuLabel}
              align="end"
              contentClassName={simple ? 'w-[min(300px,calc(100vw-16px))] min-w-[250px]' : 'min-w-[150px]'}
              trigger={
                <Hint label={menuLabel}>
                  <button
                    type="button"
                    className="relative inline-flex h-[22px] w-6 cursor-pointer items-center justify-center rounded-[5px] border-0 bg-transparent p-0 text-sm leading-none text-fg3 hover:bg-panel hover:text-fg data-[state=open]:bg-panel data-[state=open]:text-fg"
                    aria-label={menuLabel}
                  >
                    <MoreIcon aria-hidden />
                    {simple && attention && (
                      <span className="absolute top-0.5 right-0.5 size-[7px] rounded-full bg-block shadow-[0_0_0_2px_var(--card)]" data-testid="card-attention" />
                    )}
                  </button>
                </Hint>
              }
            >
              {simple && (
                <span className="flex flex-col gap-2 px-2 pt-1.5 pb-2" data-testid="card-details">
                  {spec.blocked && (
                    <Detail label="Blocked" ink="text-block-ink">
                      {spec.blockedReasons.join(' · ')}
                    </Detail>
                  )}
                  {fileProblem !== undefined && (
                    <Detail label="File problem" ink="text-review-ink">
                      {fileProblem}
                    </Detail>
                  )}
                  {spec.status === 'review' && <Detail label="Status">Waiting on your review</Detail>}
                  <Detail label="Urgency">
                    <Urgency level={spec.urgency} />
                  </Detail>
                  {spec.categories.length > 0 && (
                    <Detail label="Categories">
                      {spec.categories.map((c) => (
                        <CategoryTag key={c} name={c} />
                      ))}
                    </Detail>
                  )}
                  {needs.length > 0 && (
                    <Detail label="Needs">
                      {needs.map(depItem).map((d) => (
                        <span key={d.id} className={cn('font-mono', d.className)}>
                          {d.id}
                        </span>
                      ))}
                    </Detail>
                  )}
                  {neededBy.length > 0 && (
                    <Detail label="Needed by">
                      {neededBy.map((id) => (
                        <span key={id} className="font-mono">
                          {id}
                        </span>
                      ))}
                    </Detail>
                  )}
                </span>
              )}
              {simple && spec.status === 'done' && <ResponsiveMenuSeparator />}
              {spec.status === 'done' && (
                <ResponsiveMenuItem onSelect={spec.archived ? onUnarchive : onArchive}>{spec.archived ? 'Unarchive' : 'Archive'}</ResponsiveMenuItem>
              )}
            </ResponsiveMenu>
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <div className="text-[14.5px] leading-[1.3] font-semibold text-pretty">{spec.title}</div>
        <div className="line-clamp-2 text-[13px] leading-[1.45] text-fg2"><InlineMarkdown md={firstParagraph(spec.bodyMd)} /></div>
      </div>

      {!simple && (
        <div className="flex flex-wrap items-center gap-[5px]">
          {spec.categories.map((c) => (
            <CategoryTag key={c} name={c} />
          ))}
          <span className="flex-1" />
          <Urgency level={spec.urgency} />
        </div>
      )}

      {!simple && (needs.length > 0 || neededBy.length > 0) && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-[11.5px] text-fg3">
              {needs.length > 0 && (
                <span className="inline-flex items-baseline gap-1">
                  <NeedsIcon aria-hidden /> needs
                  {needs.length <= 2 ? (
                    needs.map(depItem).map((d) => (
                      <span key={d.id} className={cn('font-mono', d.className)}>
                        {d.id}
                      </span>
                    ))
                  ) : (
                    <span className={cn('font-semibold', anyNeedOpen ? 'text-block-ink' : 'text-fg3')}>{needs.length}</span>
                  )}
                </span>
              )}
              {neededBy.length > 0 && (
                <span className="inline-flex items-baseline gap-1">
                  <NeededByIcon aria-hidden /> needed by
                  {neededBy.length <= 2 ? (
                    neededBy.map((id) => (
                      <span key={id} className="font-mono">
                        {id}
                      </span>
                    ))
                  ) : (
                    <span className="font-semibold">{neededBy.length}</span>
                  )}
                </span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="start" className="max-w-[280px] px-[9px] py-[7px] leading-[1.45]">
            {depTip}
          </TooltipContent>
        </Tooltip>
      )}

      {isRunning && (
        <div className={cn(banner, 'min-w-0 bg-doing-soft text-doing-ink')}>
          <Pulse />
          <span className="truncate">
            Claude is working
            {running !== '' && <span className="font-normal opacity-85"> · {running}</span>}
          </span>
        </div>
      )}
      {writing && (
        <div className={cn(banner, 'bg-doing-soft text-doing-ink')}>
          <Pulse />
          Claude is writing it up
        </div>
      )}
      {!simple && spec.status === 'review' && (
        <div className={cn(banner, 'bg-review-soft font-semibold text-review-ink')}>
          <ReviewIcon aria-hidden className="text-[11px]" />
          Waiting on your review
        </div>
      )}

      <div className="flex min-h-6 items-center gap-2.5">
        {isDraft && (
          <button
            type="button"
            className="inline-flex h-6 cursor-pointer items-center gap-1.5 rounded-md border-0 bg-accent-soft px-[9px] py-0 text-xs font-semibold text-accent-ink hover:bg-accent hover:text-accent-fg"
            onClick={stop(onWriteUp)}
          >
            <PlayIcon aria-hidden className="text-[11px]" />
            Have Claude write this up
          </button>
        )}
        {total > 0 && !writing && (
          <div className="flex items-center gap-[7px]" title="Subtasks done">
            <div className="h-1 w-[52px] overflow-hidden rounded-full bg-line">
              {/* The width is the live progress. */}
              <div className={cn('h-full rounded-full transition-[width] duration-500', complete ? 'bg-done' : 'bg-fg2')} style={{ width: pct }} />
            </div>
            <span className="font-mono text-[11.5px] text-fg2">
              {done}/{total}
            </span>
          </div>
        )}
        <span className="flex-1" />
        {!simple && (
          <button
            type="button"
            className="h-6 cursor-pointer rounded-md border border-line bg-transparent px-2.5 py-0 text-xs text-fg2 hover:border-line2 hover:text-fg"
            onClick={stop(onOpen)}
          >
            View
          </button>
        )}
      </div>
    </div>
  );
}
