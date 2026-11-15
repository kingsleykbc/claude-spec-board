import { useCallback, useEffect, useRef, useState } from 'react';
import type { DragEvent, HTMLAttributes, KeyboardEvent, MouseEvent, ReactNode } from 'react';
import type { Spec } from '@specboard/core';
import { MoreIcon, NeededByIcon, NeedsIcon, PlayIcon, ReviewIcon, WarnIcon } from '../lib/icons';
import { firstParagraph, statusMeta } from '../lib/vm';
import { useSimple } from '../state/simpleMode';
import { CategoryTag } from '@/components/ui/category-tag/category-tag';
import { Urgency } from '@/components/ui/urgency/urgency';
import s from './SpecCard.module.css';

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

type Tip = 'blocked' | 'file' | 'deps' | null;

/** One labelled row in the Simple mode ⋯ menu. */
function Detail({ label, ink, children }: { label: string; ink?: string; children: ReactNode }) {
  return (
    <span className={s.detail}>
      <span className={s.detailLabel} style={ink ? { color: ink } : undefined}>
        {label}
      </span>
      <span className={s.detailValue}>{children}</span>
    </span>
  );
}

const stop = (fn?: () => void) => (e: MouseEvent) => {
  e.stopPropagation();
  fn?.();
};

function Pulse() {
  return <span className={s.pulse} />;
}

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
  const [tip, setTip] = useState<Tip>(null);
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      ref.current = el;
      dragRef?.(el);
    },
    [dragRef],
  );

  // Close the ⋯ menu on a press outside the card or on Escape.
  useEffect(() => {
    if (!menu) return;
    const down = (e: globalThis.MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setMenu(false);
    };
    const key = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(false);
    };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', down);
      document.removeEventListener('keydown', key);
    };
  }, [menu]);

  const { subtasks } = spec;
  const total = subtasks.length;
  const done = subtasks.filter((t) => t.done).length;
  const pct = total ? Math.round((done / total) * 100) + '%' : '0%';
  const barColor = total && done === total ? 'var(--done)' : 'var(--fg2)';

  const find = (id: string) => all.find((x) => x.id === id);
  const needs = spec.dependsOn;
  const neededBy = spec.dependents;
  const depItem = (id: string) => {
    const d = find(id);
    const notDone = !d || d.status !== 'done';
    return { id, color: notDone ? 'var(--block-ink)' : 'var(--fg3)', weight: notDone ? 600 : 400 };
  };
  const anyNeedOpen = needs.some((id) => depItem(id).weight === 600);
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
  const tipOff = () => setTip(null);
  /** Simple mode hides these, so the ⋯ button carries a dot to say something needs a look. */
  const attention = spec.blocked || fileProblem !== undefined;
  const showMenu = simple || spec.status === 'done';

  const bg = forceHover ? 'var(--raise)' : flash ? 'var(--accent-soft)' : undefined;
  const border = forceHover ? 'var(--line2)' : flash ? 'var(--accent)' : undefined;
  const shadow = lifted ? '0 18px 40px oklch(0.2 0.01 60 / .22)' : flash ? '0 0 0 3px var(--accent-soft)' : undefined;

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
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
  const dragStart = (e: DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('text/plain', spec.id);
    e.dataTransfer.effectAllowed = 'move';
    onDragStart?.();
  };

  return (
    <div
      {...dragProps}
      ref={setRef}
      className={s.card}
      role="button"
      tabIndex={0}
      aria-label={`${spec.id} ${spec.title}`}
      draggable={onDragStart !== undefined || onDragEnd !== undefined}
      onDragStart={dragStart}
      onDragEnd={() => onDragEnd?.()}
      onClick={onOpen}
      onKeyDown={onKey}
      style={{
        background: bg,
        borderColor: border,
        boxShadow: shadow,
        opacity: dragging ? 0.4 : spec.archived ? 0.62 : 1,
        transform: lifted ? 'rotate(-1.8deg)' : 'none',
      }}
    >
      <div className={s.top}>
        <span className={s.id}>{spec.id}</span>
        {isDraft && <span className={s.draft}>Draft</span>}
        {spec.archived && <span className={s.archived}>· Archived</span>}
        <span className={s.spacer} />
        {!simple && fileProblem !== undefined && (
          <span className={`${s.badge} ${s.file}`} onMouseEnter={() => setTip('file')} onMouseLeave={tipOff}>
            <WarnIcon aria-hidden /> File problem
            {tip === 'file' && <span className={s.tip}>{fileProblem}</span>}
          </span>
        )}
        {!simple && spec.blocked && (
          <span className={`${s.badge} ${s.blocked}`} onMouseEnter={() => setTip('blocked')} onMouseLeave={tipOff}>
            <span className={s.bang}>!</span>Blocked
            {tip === 'blocked' && <span className={s.tip}>{spec.blockedReasons.join(' · ')}</span>}
          </span>
        )}
        {showMenu && (
          <span className={s.menuWrap}>
            <button
              type="button"
              className={s.dots}
              aria-label={simple ? `More about ${spec.id}` : 'Card actions'}
              aria-haspopup="menu"
              aria-expanded={menu}
              onClick={stop(() => setMenu((m) => !m))}
            >
              <MoreIcon aria-hidden />
              {simple && attention && <span className={s.attention} data-testid="card-attention" />}
            </button>
            {menu && (
              <span className={`${s.menu} ${simple ? s.menuWide : ''}`} role="menu" onClick={(e) => e.stopPropagation()}>
                {simple && (
                  <span className={s.details} data-testid="card-details">
                    {spec.blocked && (
                      <Detail label="Blocked" ink="var(--block-ink)">
                        {spec.blockedReasons.join(' · ')}
                      </Detail>
                    )}
                    {fileProblem !== undefined && (
                      <Detail label="File problem" ink="var(--review-ink)">
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
                          <span key={d.id} className={s.mono} style={{ color: d.color, fontWeight: d.weight }}>
                            {d.id}
                          </span>
                        ))}
                      </Detail>
                    )}
                    {neededBy.length > 0 && (
                      <Detail label="Needed by">
                        {neededBy.map((id) => (
                          <span key={id} className={s.mono}>
                            {id}
                          </span>
                        ))}
                      </Detail>
                    )}
                  </span>
                )}
                {spec.status === 'done' && (
                <button
                  type="button"
                  role="menuitem"
                  className={s.menuItem}
                  onClick={stop(() => {
                    setMenu(false);
                    if (spec.archived) onUnarchive();
                    else onArchive();
                  })}
                >
                  {spec.archived ? 'Unarchive' : 'Archive'}
                </button>
                )}
              </span>
            )}
          </span>
        )}
      </div>

      <div className={s.text}>
        <div className={s.title}>{spec.title}</div>
        <div className={s.desc}>{firstParagraph(spec.bodyMd)}</div>
      </div>

      {!simple && (
      <div className={s.meta}>
        {spec.categories.map((c) => (
          <CategoryTag key={c} name={c} />
        ))}
        <span className={s.spacer} />
        <Urgency level={spec.urgency} />
      </div>
      )}

      {!simple && (needs.length > 0 || neededBy.length > 0) && (
        <div className={s.deps} onMouseEnter={() => setTip('deps')} onMouseLeave={tipOff}>
          {needs.length > 0 && (
            <span className={s.depGroup}>
              <NeedsIcon aria-hidden /> needs
              {needs.length <= 2 ? (
                needs.map(depItem).map((d) => (
                  <span key={d.id} className={s.mono} style={{ color: d.color, fontWeight: d.weight }}>
                    {d.id}
                  </span>
                ))
              ) : (
                <span style={{ color: anyNeedOpen ? 'var(--block-ink)' : 'var(--fg3)', fontWeight: 600 }}>{needs.length}</span>
              )}
            </span>
          )}
          {neededBy.length > 0 && (
            <span className={s.depGroup}>
              <NeededByIcon aria-hidden /> needed by
              {neededBy.length <= 2 ? (
                neededBy.map((id) => (
                  <span key={id} className={s.mono}>
                    {id}
                  </span>
                ))
              ) : (
                <span style={{ fontWeight: 600 }}>{neededBy.length}</span>
              )}
            </span>
          )}
          {tip === 'deps' && <span className={`${s.tip} ${s.depTip}`}>{depTip}</span>}
        </div>
      )}

      {isRunning && (
        <div className={`${s.banner} ${s.doing}`} style={{ minWidth: 0 }}>
          <Pulse />
          <span className={s.ellipsis}>
            Claude is working
            {running !== '' && <span className={s.runSub}> · {running}</span>}
          </span>
        </div>
      )}
      {writing && (
        <div className={`${s.banner} ${s.doing}`}>
          <Pulse />
          Claude is writing it up
        </div>
      )}
      {!simple && spec.status === 'review' && (
        <div className={`${s.banner} ${s.review}`}>
          <ReviewIcon aria-hidden className={s.diamond} />
          Waiting on your review
        </div>
      )}

      <div className={s.foot}>
        {isDraft && (
          <button type="button" className={s.writeUp} onClick={stop(onWriteUp)}>
            <PlayIcon aria-hidden className={s.play} />
            Have Claude write this up
          </button>
        )}
        {total > 0 && !writing && (
          <div className={s.progress} title="Subtasks done">
            <div className={s.track}>
              <div className={s.fill} style={{ width: pct, background: barColor }} />
            </div>
            <span className={s.count}>
              {done}/{total}
            </span>
          </div>
        )}
        <span className={s.spacer} />
        {!simple && (
          <button type="button" className={s.view} onClick={stop(onOpen)}>
            View
          </button>
        )}
      </div>
    </div>
  );
}
