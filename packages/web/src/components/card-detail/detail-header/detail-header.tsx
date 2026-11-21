import { useRef, type ReactNode } from 'react';
import type { Status, Urgency } from '@specboard/core';
import { CloseIcon, MoreIcon, RefreshIcon } from '@/lib/icons';
import { ESC, runEscape, useEscape } from '@/lib/escape';
import { FileLink } from '@/state/fileLinks';
import { Hint } from '@/components/ui/hint/hint';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover/popover';
import { CategoryEditor } from '../category-editor/category-editor';
import type { ManualReason } from '@/state/runUi';
import { offButton, RunButton, secondaryButton, type RunState } from '../run-button/run-button';
import { StatusMenu } from '../status-menu/status-menu';
import { UrgencyControl } from '../urgency-control/urgency-control';

export interface DetailHeaderProps {
  id: string;
  /** Project-relative path of the spec file. */
  path: string;
  title: string;
  status: Status;
  urgency: Urgency;
  categories: string[];
  /** Every category in the project, for suggestions. */
  allCategories: string[];
  runState: RunState;
  runningId?: string | null;
  runHold?: string | null;
  runBlockedNote?: string | undefined;
  runBusyNote?: string | undefined;
  /** Why the board can't run Claude here; Run with Claude explains instead of starting. */
  manual?: ManualReason | null;
  /** Claude's status has loaded. */
  statusKnown?: boolean;
  onRun: () => void;
  onStop: () => void;
  /** Sync this spec with the code; off while any run is active, like Run. */
  onSync?: () => void;
  /** A sync proposal for this spec is waiting. */
  syncWaiting?: boolean;
  onSyncWaiting?: () => void;
  onStatus: (s: Status) => void;
  onUrgency: (u: Urgency) => void;
  onAddCategory: (c: string) => void;
  onRemoveCategory: (c: string) => void;
  onClose: () => void;
  /** Simple mode: urgency, categories and `dependencies` sit in a ⋯ popover instead of under the title. */
  simple?: boolean;
  detailsOpen?: boolean;
  onDetails?: (open: boolean) => void;
  dependencies?: ReactNode;
}

const SYNC_TITLE = 'Checks this spec against the code and shows what would change before changing anything.';

// Phones (640px and under): the top row wraps. The ID and × stay on the first line; the run controls, status
// and ⋯ follow on the next, and the path last, on a line of its own (the ::after is the line break).
// (Class names are written out in full so Tailwind finds them.)
const row =
  "flex min-h-[34px] items-center gap-2.5 [@media(max-width:640px)]:flex-wrap [@media(max-width:640px)]:*:order-2 [@media(max-width:640px)]:after:order-1 [@media(max-width:640px)]:after:h-0 [@media(max-width:640px)]:after:basis-full [@media(max-width:640px)]:after:content-['']";
const moreLabel = 'mt-1.5 text-[11px] font-semibold tracking-[0.09em] text-fg3 first:mt-0';

/** Card detail header (pinned behaviour 7; prototype lines 124-157). */
export function DetailHeader(p: DetailHeaderProps) {
  const urgency = <UrgencyControl value={p.urgency} onPick={p.onUrgency} />;
  const cats = <CategoryEditor categories={p.categories} all={p.allCategories} onAdd={p.onAddCategory} onRemove={p.onRemoveCategory} />;
  const open = Boolean(p.simple && p.detailsOpen);
  /** Set while the closing ⋯ popover hands focus back to its trigger. */
  const returning = useRef(false);
  // The ⋯ popover is a layer of the board's Esc stack: a category input open inside it closes first.
  useEscape(open, () => p.onDetails?.(false), ESC.menu);
  /** A run is active (here or on another spec): Sync waits, like Run. */
  const busy = p.runState === 'running' || p.runState === 'disabled';
  return (
    <div className="flex flex-col gap-3 border-b border-line px-7 pt-5 pb-4 [@media(max-width:640px)]:px-4 [@media(max-width:640px)]:pt-3.5 [@media(max-width:640px)]:pb-3">
      <div className={row}>
        <span className="flex-none font-mono text-[13px] font-semibold whitespace-nowrap text-fg2 [@media(max-width:640px)]:order-0! [@media(max-width:640px)]:flex-1">
          {p.id}
        </span>
        <FileLink
          path={p.path}
          className="min-w-[120px] flex-1 overflow-hidden text-[11.5px] text-ellipsis whitespace-nowrap text-fg3 [@media(max-width:640px)]:order-3! [@media(max-width:640px)]:min-w-0 [@media(max-width:640px)]:basis-full"
        />
        <RunButton id={p.id} state={p.runState} runningId={p.runningId ?? null} hold={p.runHold ?? null} blockedNote={p.runBlockedNote} busyNote={p.runBusyNote} manual={p.manual ?? null} statusKnown={p.statusKnown ?? true} onRun={p.onRun} onStop={p.onStop} />
        {p.syncWaiting && p.onSyncWaiting && (
          <button
            type="button"
            className="flex h-7 cursor-pointer items-center rounded-full border-0 bg-review-soft px-2.5 py-0 text-[12px] font-semibold whitespace-nowrap text-review-ink"
            onClick={p.onSyncWaiting}
          >
            Sync proposal waiting
          </button>
        )}
        {p.onSync &&
          (busy ? (
            <button type="button" className={offButton} disabled>
              <RefreshIcon aria-hidden />
              Sync
            </button>
          ) : (
            <Hint label={SYNC_TITLE}>
              <button type="button" className={secondaryButton} aria-label="Sync" onClick={p.onSync}>
                <RefreshIcon aria-hidden />
                Sync
              </button>
            </Hint>
          ))}
        <StatusMenu status={p.status} onPick={p.onStatus} />
        {p.simple && (
          <Popover open={open} onOpenChange={(o) => p.onDetails?.(o)}>
            <PopoverTrigger asChild>
              <Hint label="More details">
                <button
                  type="button"
                  className="flex size-[34px] flex-none cursor-pointer items-center justify-center rounded-lg border border-line bg-card p-0 text-[17px] text-fg2 hover:border-line2 hover:text-fg aria-expanded:border-line2 aria-expanded:text-fg"
                  aria-label="More details"
                  onFocus={(e) => {
                    // Focus coming back from the closing popover: keep its tooltip shut (the Tooltip trigger skips a
                    // prevented focus), or the next Esc would only close the tooltip instead of the detail.
                    if (!returning.current) return;
                    returning.current = false;
                    e.preventDefault();
                  }}
                >
                  <MoreIcon aria-hidden />
                </button>
              </Hint>
            </PopoverTrigger>
            <PopoverContent
              aria-label="More details"
              align="end"
              sideOffset={6}
              collisionPadding={8}
              onCloseAutoFocus={() => {
                // Radix moves focus to the trigger right after this, in the same task; the flag only covers that move.
                returning.current = true;
                queueMicrotask(() => {
                  returning.current = false;
                });
              }}
              className="flex max-h-[min(70vh,560px)] w-[min(420px,calc(100vw-48px))] flex-col items-start gap-2 overflow-auto px-4 pt-3.5 pb-4"
              onEscapeKeyDown={(e) => {
                // The board's Esc stack decides: an open category input first, then this popover.
                e.preventDefault();
                runEscape();
              }}
            >
              <span className={moreLabel}>URGENCY</span>
              {urgency}
              <span className={moreLabel}>CATEGORIES</span>
              {cats}
              <span className={moreLabel}>DEPENDENCIES</span>
              {p.dependencies}
            </PopoverContent>
          </Popover>
        )}
        <Hint label="Close">
          <button
            type="button"
            className="flex size-[34px] cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent p-0 text-[18px] leading-none text-fg2 hover:bg-panel [@media(max-width:640px)]:order-1!"
            aria-label="Close"
            onClick={p.onClose}
          >
            <CloseIcon aria-hidden />
          </button>
        </Hint>
      </div>
      <h1 className="m-0 text-[26px] leading-[1.2] font-semibold tracking-[-0.015em] [@media(max-width:640px)]:text-[21px]">{p.title}</h1>
      {!p.simple && (
        <div className="flex flex-wrap items-center gap-3.5">
          {urgency}
          <span className="h-[18px] w-px bg-line" />
          {cats}
        </div>
      )}
    </div>
  );
}
