import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

// Skeleton loaders: grey shapes where the content will be, shown while it loads.
// The shimmer (`sb-skel` in styles/base.css) stops for people who ask for less motion.

/** One grey block. Its size comes from the caller, so it is set inline. */
export function Skel({ w, h = 10, r, className, style }: { w: number | string; h?: number; r?: number; className?: string; style?: CSSProperties }) {
  return (
    <span
      className={cn('sb-skel', className)}
      aria-hidden
      style={{ width: w, height: h, ...(r !== undefined ? { borderRadius: r } : {}), ...style }}
    />
  );
}

/** Read out once by screen readers, and what tests look for. */
function Label({ text }: { text: string }) {
  return <span className="sr-only">{text}</span>;
}

function CardSkeleton({ title, lines }: { title: string; lines: number }) {
  return (
    <div className="flex flex-col gap-[9px] rounded-[10px] border border-line bg-card px-[13px] pt-[13px] pb-3">
      <Skel w={44} h={9} />
      <Skel w={title} h={13} />
      {Array.from({ length: lines }, (_, i) => (
        <Skel key={i} w={i === lines - 1 ? '62%' : '92%'} h={9} />
      ))}
      <div className="mt-[3px] flex gap-1.5">
        <Skel w={52} h={16} r={99} />
        <Skel w={38} h={16} r={99} />
      </div>
    </div>
  );
}

/** Cards per column, and their title widths, so the board looks like a board while it loads. */
const COLUMNS: { label: number; cards: [string, number][] }[] = [
  { label: 46, cards: [['78%', 2], ['64%', 2], ['70%', 1]] },
  { label: 40, cards: [['72%', 2]] },
  { label: 50, cards: [['66%', 1]] },
  { label: 38, cards: [['74%', 2], ['58%', 1]] },
];

// The board and column layout, as the real board has it (four columns; below 1100px they scroll sideways).
const board =
  'relative grid grid-cols-4 items-stretch gap-3 px-5 pt-0 pb-[100px] [@media(max-width:1100px)]:flex [@media(max-width:1100px)]:snap-x [@media(max-width:1100px)]:snap-mandatory [@media(max-width:1100px)]:overflow-x-auto';
const column =
  'flex min-h-[calc(100vh-170px)] flex-col gap-2 rounded-xl p-2 outline-offset-[-1.5px] transition-[background] duration-150 ease-[ease] [@media(max-width:1100px)]:max-h-[calc(100vh-170px)] [@media(max-width:1100px)]:flex-[0_0_300px] [@media(max-width:1100px)]:snap-start [@media(max-width:1100px)]:overflow-y-auto';

/** The filter bar and four columns of cards. */
export function BoardSkeleton() {
  return (
    <div role="status" aria-live="polite" data-testid="board-skeleton">
      <Label text="Loading the board…" />
      <div className="flex items-center gap-2 px-5 pt-3 pb-2.5">
        <Skel w={92} h={30} r={8} />
        <Skel w={86} h={30} r={8} />
        <Skel w={118} h={30} r={8} />
        <Skel w={116} h={30} r={8} />
      </div>
      <div className={board}>
        {COLUMNS.map((c, i) => (
          <div key={i} className={column} data-testid="skeleton-column">
            <div className="flex min-h-[30px] items-center gap-2 px-1.5 pt-1 pb-1.5">
              <Skel w={14} h={14} r={99} />
              <Skel w={c.label} h={11} />
            </div>
            {c.cards.map(([t, n], j) => (
              <CardSkeleton key={j} title={t} lines={n} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Before the project list arrives: the top bar's outline above the board. */
export function AppSkeleton() {
  return (
    <>
      <div className="sticky top-0 z-30 flex h-[52px] items-center gap-2.5 border-b border-line bg-bg px-5" aria-hidden>
        <Skel w={118} h={20} r={6} />
        <Skel w={150} h={20} r={6} />
        <span className="flex-1" />
        <Skel w={84} h={30} r={8} />
        <Skel w={80} h={30} r={8} />
        <Skel w={32} h={32} r={8} />
      </div>
      <BoardSkeleton />
    </>
  );
}

/** A heading and paragraphs, for a document that is loading. */
export function DocSkeleton({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-2.5 py-1" data-testid="doc-skeleton">
      <Label text={label} />
      <Skel w="42%" h={18} />
      <Skel w="96%" />
      <Skel w="90%" />
      <Skel w="70%" />
      <Skel w="94%" className="mt-2.5" />
      <Skel w="82%" />
    </div>
  );
}
