import { useRef, type ReactNode } from 'react';
import type { Status, Urgency } from '@specboard/core';
import { MoreIcon, RefreshIcon } from '@/lib/icons';
import { ESC, runEscape, useEscape } from '@/lib/escape';
import { FileLink } from '@/state/fileLinks';
import { Hint } from '@/components/ui/hint/hint';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover/popover';
import { ModalClose } from '@/components/ui/modal/modal';
import { ResponsiveMenu, ResponsiveMenuItem } from '@/components/ui/responsive-menu/responsive-menu';
import { WriteUpButton } from '@/components/write-up-button/write-up-button';
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
  /** A draft: the header shows the Draft badge and Have Claude write this up. */
  draft?: boolean;
  onWriteUp?: () => void;
  /** Archive or Unarchive (for an archived spec) from the ⋯ menu; none without `onArchive`/`onUnarchive`. */
  archived?: boolean;
  onArchive?: () => void;
  onUnarchive?: () => void;
  /** Simple mode: urgency, categories and `dependencies` sit in a ⋯ popover instead of under the title. */
  simple?: boolean;
  detailsOpen?: boolean;
  onDetails?: (open: boolean) => void;
  dependencies?: ReactNode;
}

const SYNC_TITLE = 'Checks this spec against the code and shows what would change before changing anything.';

// Two rows. Row 1 is identity: ID, path (cut with … when long), status and the ⋯ menu; the close button is pinned at
// the top right by ModalClose, so row 1 keeps 44px free there. Row 2 is actions and wraps when the width runs out. On
// phones (640px and under) the path drops to a line of its own under the ID.
const row1 = 'flex min-h-[34px] flex-wrap items-center gap-x-2.5 gap-y-1 pr-[44px]';
const row2 = 'flex flex-wrap items-center gap-x-2.5 gap-y-2';
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
  const archiveItem = p.archived ? p.onUnarchive : p.onArchive;
  const actionsMenu = !p.simple && archiveItem && (
    <ResponsiveMenu
      title="Card actions"
      align="end"
      contentClassName="min-w-[150px]"
      trigger={
        <Hint label="Card actions">
          <button
            type="button"
            className="flex size-[34px] flex-none cursor-pointer items-center justify-center rounded-lg border border-line bg-card p-0 text-[17px] text-fg2 hover:border-line2 hover:text-fg aria-expanded:border-line2 aria-expanded:text-fg"
            aria-label="Card actions"
          >
            <MoreIcon aria-hidden />
          </button>
        </Hint>
      }
    >
      <ResponsiveMenuItem onSelect={archiveItem}>{p.archived ? 'Unarchive' : 'Archive'}</ResponsiveMenuItem>
    </ResponsiveMenu>
  );
  return (
    <div className="relative flex flex-col gap-3 border-b border-line px-7 pt-[18px] pb-4 [@media(max-width:640px)]:px-4 [@media(max-width:640px)]:pb-3">
      <ModalClose onClick={p.onClose} />
      <div className={row1}>
        <span className="flex-none font-mono text-[13px] font-semibold whitespace-nowrap text-fg2 [@media(max-width:640px)]:flex-1">{p.id}</span>
        <FileLink
          path={p.path}
          className="min-w-[120px] flex-1 overflow-hidden text-[11.5px] text-ellipsis whitespace-nowrap text-fg3 [@media(max-width:640px)]:order-last [@media(max-width:640px)]:min-w-0 [@media(max-width:640px)]:basis-full"
        />
        <StatusMenu status={p.status} onPick={p.onStatus} />
        {actionsMenu}
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
              {archiveItem && (
                <button
                  type="button"
                  className="mt-1.5 h-[30px] cursor-pointer rounded-lg border border-line2 bg-card px-3 text-[12.5px] font-semibold text-fg hover:bg-panel"
                  onClick={() => {
                    p.onDetails?.(false);
                    archiveItem();
                  }}
                >
                  {p.archived ? 'Unarchive' : 'Archive'}
                </button>
              )}
            </PopoverContent>
          </Popover>
        )}
      </div>
      <div className={row2} data-testid="detail-actions">
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
        {p.draft && (
          <>
            <span className="rounded-[5px] border border-dashed border-line2 px-[7px] py-px text-[11px] font-semibold text-fg2">Draft</span>
            {p.runState !== 'running' && p.onWriteUp && <WriteUpButton id={p.id} manual={p.manual ?? null} statusKnown={p.statusKnown ?? true} onWriteUp={p.onWriteUp} size="md" />}
          </>
        )}
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
