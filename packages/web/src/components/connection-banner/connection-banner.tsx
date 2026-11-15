import type { Conn } from '@/api/live';
import { cn } from '@/lib/utils';

/** The prototype's spinner (line 544). */
export function Spinner() {
  return (
    <span
      aria-hidden="true"
      data-testid="spinner"
      className="inline-block size-[11px] flex-none animate-sb-spin rounded-full border-2 border-line2 border-t-doing"
    />
  );
}

export const CONN_COPY = {
  reconnecting: { title: 'Reconnecting…', text: 'Edits will save once the connection is back.' },
  disconnected: { title: 'Disconnected from the local server.', text: 'The board can’t see file changes, and edits won’t save until it’s back.' },
} as const;

export interface ConnectionBannerProps {
  conn: Conn;
  onReconnect: () => void;
}

/** Shown under the top bar when not live (prototype lines 54-60; pinned behaviour 15). */
export function ConnectionBanner({ conn, onReconnect }: ConnectionBannerProps) {
  if (conn === 'live') return null;
  const down = conn === 'disconnected';
  const copy = CONN_COPY[conn];
  return (
    <div role="status" className={cn('flex items-center gap-2.5 border-b border-line px-5 py-[9px] text-[13px] text-fg', down ? 'bg-block-soft' : 'bg-review-soft')}>
      {!down && <Spinner />}
      {down && <span className="size-2 rounded-full bg-block" />}
      <span className="font-semibold">{copy.title}</span>
      <span className="text-fg2">{copy.text}</span>
      <span className="flex-1" />
      {down && (
        <button
          type="button"
          onClick={onReconnect}
          className="h-7 cursor-pointer rounded-[7px] border border-line2 bg-card px-3 py-0 text-[12.5px] font-semibold"
        >
          Reconnect
        </button>
      )}
    </div>
  );
}
