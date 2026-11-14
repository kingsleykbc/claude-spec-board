import { useMemo, useState } from 'react';
import type { HTMLAttributes } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
} from '@dnd-kit/core';
import type { Spec, Status } from '@specboard/core';
import type { RunSnapshot } from '../api/client';
import { PlusIcon } from '../lib/icons';
import { ORDER, ST } from '../lib/vm';
import { filterSpecs, NO_FILTERS, sortSpecs, compareSpecs, type Filters } from '../state/filters';
import { cardRun } from '../state/runUi';
import { Column } from './Column';
import { SpecCard } from './SpecCard';
import s from './Board.module.css';

export interface BoardProps {
  /** Active specs (unfiltered; the board applies `filters`). */
  specs: Spec[];
  /** Archived specs (unfiltered). */
  archived: Spec[];
  filters?: Filters;
  /** The project's milestone list, so `filters.milestone` applies (the board shows one milestone). */
  milestones?: string[];
  /** The project's run: its spec's card shows that Claude is working on it. */
  run?: RunSnapshot | null;
  /** False while disconnected: no dragging. */
  canDrag: boolean;
  /** Spec IDs to flash (live highlight). */
  changed?: Set<string>;
  onMove: (spec: Spec, status: Status) => void;
  onOpen: (id: string) => void;
  onArchive: (spec: Spec) => void;
  onUnarchive: (spec: Spec) => void;
  onWriteUp: (spec: Spec) => void;
  onAdd: () => void;
}

/** The column under the pointer; with no pointer (keyboard), the column the card overlaps most. */
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length > 0 ? hits : rectIntersection(args);
};

/** Arrow Left/Right moves a picked-up card to the neighbouring column. */
const columnKeys: KeyboardCoordinateGetter = (event, { context, currentCoordinates }) => {
  const step = event.code === 'ArrowRight' ? 1 : event.code === 'ArrowLeft' ? -1 : 0;
  if (step === 0) return undefined;
  event.preventDefault();
  const from = (context.over?.id ?? context.active?.data.current?.status) as Status | undefined;
  const i = from ? ORDER.indexOf(from) : -1;
  const target = ORDER[Math.min(ORDER.length - 1, Math.max(0, i + step))];
  const rect = target ? context.droppableRects.get(target) : undefined;
  if (!rect) return currentCoordinates;
  return { x: rect.left + 8, y: currentCoordinates.y };
};

const label = (id: unknown) => (typeof id === 'string' && id in ST ? ST[id as Status].label : String(id));
const announcements: Announcements = {
  onDragStart: ({ active }) => `Picked up ${String(active.id)}.`,
  onDragOver: ({ active, over }) => (over ? `${String(active.id)} is over ${label(over.id)}.` : `${String(active.id)} is not over a column.`),
  onDragEnd: ({ active, over }) => (over ? `${String(active.id)} was dropped on ${label(over.id)}.` : `${String(active.id)} was dropped.`),
  onDragCancel: ({ active }) => `Moving ${String(active.id)} was cancelled.`,
};

interface CardProps {
  spec: Spec;
  all: Spec[];
  canDrag: boolean;
  flash: boolean;
  p: BoardProps;
}

function DraggableCard({ spec, all, canDrag, flash, p }: CardProps) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: spec.id, data: { status: spec.status }, disabled: !canDrag || spec.archived });
  const dragProps = { ...attributes, ...listeners } as HTMLAttributes<HTMLDivElement>;
  const { running, writing } = cardRun(p.run ?? null, spec);
  return (
    <SpecCard
      spec={spec}
      all={all}
      running={running}
      writing={writing}
      flash={flash}
      dragging={isDragging}
      dragRef={setNodeRef}
      dragProps={dragProps}
      onOpen={() => p.onOpen(spec.id)}
      onArchive={() => p.onArchive(spec)}
      onUnarchive={() => p.onUnarchive(spec)}
      onWriteUp={() => p.onWriteUp(spec)}
    />
  );
}

const noop = () => undefined;

/** The four columns with drag and drop (prototype lines 89-115 and 718-731). */
export function Board(props: BoardProps) {
  const { specs, archived, filters = NO_FILTERS, milestones = [], canDrag, changed } = props;
  const [showArchived, setShowArchived] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<Status | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] }, coordinateGetter: columnKeys }),
  );

  const all = useMemo(() => [...specs, ...archived], [specs, archived]);
  const active = activeId ? specs.find((x) => x.id === activeId) ?? null : null;

  const visible = filterSpecs(specs, filters, milestones);
  const visibleArchived = showArchived ? filterSpecs(archived, filters, milestones) : [];

  const reset = () => {
    setActiveId(null);
    setOverId(null);
  };
  const onDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
    setOverId(null);
  };
  const onDragOver = (e: DragOverEvent) => setOverId((e.over?.id as Status | undefined) ?? null);
  const onDragEnd = (e: DragEndEvent) => {
    const spec = specs.find((x) => x.id === e.active.id);
    const to = e.over?.id as Status | undefined;
    reset();
    if (canDrag && spec && to && ORDER.includes(to) && spec.status !== to) props.onMove(spec, to);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={reset} accessibility={{ announcements }}>
      <main className={s.board} data-tour="columns">
        {ORDER.map((k) => {
          const list = sortSpecs([...visible.filter((x) => x.status === k), ...(k === 'done' ? visibleArchived : [])]);
          const over = !!(active && overId === k && active.status !== k);
          let placeholderAt: number | null = null;
          if (over && active) placeholderAt = list.filter((x) => compareSpecs(x, active) < 0).length;
          return (
            <Column
              key={k}
              status={k}
              specs={list}
              over={over}
              placeholderAt={placeholderAt}
              archivedCount={k === 'done' ? archived.length : 0}
              showArchived={showArchived}
              onToggleArchived={() => setShowArchived((v) => !v)}
              renderCard={(x) => <DraggableCard key={x.id} spec={x} all={all} canDrag={canDrag} flash={!!changed?.has(x.id)} p={props} />}
            />
          );
        })}
        {specs.length + archived.length === 0 && (
          <div className={s.none}>
            <div className={s.sheets}>
              <span className={s.sheet} />
              <span className={s.sheet} />
              <span className={s.sheetNew} />
            </div>
            <div className={s.noneTitle}>No specs yet</div>
            <div className={s.noneText}>
              Add one, or ask Claude to <code>/create-spec</code> in your terminal. Specs appear here as soon as the files exist.
            </div>
            <button type="button" className={s.noneAdd} onClick={props.onAdd}>
              <PlusIcon aria-hidden /> Add new spec
            </button>
          </div>
        )}
      </main>
      <DragOverlay dropAnimation={null}>
        {active ? <SpecCard spec={active} all={all} lifted onOpen={noop} onArchive={noop} onUnarchive={noop} onWriteUp={noop} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
