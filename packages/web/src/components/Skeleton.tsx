import type { CSSProperties } from 'react';
import boardCss from './Board.module.css';
import topCss from './TopBar.module.css';
import s from './Skeleton.module.css';

// Skeleton loaders: grey shapes where the content will be, shown while it loads.
// The shimmer (`sb-skel` in styles/base.css) stops for people who ask for less motion.

/** One grey block. */
export function Skel({ w, h = 10, r, style }: { w: number | string; h?: number; r?: number; style?: CSSProperties }) {
  return <span className="sb-skel" aria-hidden style={{ width: w, height: h, ...(r !== undefined ? { borderRadius: r } : {}), ...style }} />;
}

/** Read out once by screen readers, and what tests look for. */
function Label({ text }: { text: string }) {
  return <span className={s.sr}>{text}</span>;
}

function CardSkeleton({ title, lines }: { title: string; lines: number }) {
  return (
    <div className={s.card}>
      <Skel w={44} h={9} />
      <Skel w={title} h={13} />
      {Array.from({ length: lines }, (_, i) => (
        <Skel key={i} w={i === lines - 1 ? '62%' : '92%'} h={9} />
      ))}
      <div className={s.cardFoot}>
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

/** The filter bar and four columns of cards. */
export function BoardSkeleton() {
  return (
    <div role="status" aria-live="polite" data-testid="board-skeleton">
      <Label text="Loading the board…" />
      <div className={s.filters}>
        <Skel w={92} h={30} r={8} />
        <Skel w={86} h={30} r={8} />
        <Skel w={118} h={30} r={8} />
        <Skel w={116} h={30} r={8} />
      </div>
      <div className={boardCss.board}>
        {COLUMNS.map((c, i) => (
          <div key={i} className={boardCss.col} data-testid="skeleton-column">
            <div className={boardCss.head}>
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
      <div className={topCss.bar} aria-hidden>
        <Skel w={118} h={20} r={6} />
        <Skel w={150} h={20} r={6} />
        <span style={{ flex: 1 }} />
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
    <div role="status" aria-live="polite" className={s.doc} data-testid="doc-skeleton">
      <Label text={label} />
      <Skel w="42%" h={18} />
      <Skel w="96%" />
      <Skel w="90%" />
      <Skel w="70%" />
      <Skel w="94%" style={{ marginTop: 10 }} />
      <Skel w="82%" />
    </div>
  );
}
