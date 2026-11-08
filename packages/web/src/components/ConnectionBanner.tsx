import type { Conn } from '../api/live';

/** The prototype's spinner (line 544). */
export function Spinner() {
  return (
    <span
      aria-hidden="true"
      data-testid="spinner"
      style={{ display: 'inline-block', width: 11, height: 11, flex: 'none', border: '2px solid var(--line2)', borderTopColor: 'var(--doing)', borderRadius: 99, animation: 'sbSpin .8s linear infinite' }}
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
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 20px',
        background: down ? 'var(--block-soft)' : 'var(--review-soft)',
        borderBottom: '1px solid var(--line)',
        fontSize: 13,
        color: 'var(--fg)',
      }}
    >
      {!down && <Spinner />}
      {down && <span style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--block)' }} />}
      <span style={{ fontWeight: 600 }}>{copy.title}</span>
      <span style={{ color: 'var(--fg2)' }}>{copy.text}</span>
      <span style={{ flex: 1 }} />
      {down && (
        <button
          type="button"
          onClick={onReconnect}
          style={{ height: 28, padding: '0 12px', border: '1px solid var(--line2)', borderRadius: 7, background: 'var(--card)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
        >
          Reconnect
        </button>
      )}
    </div>
  );
}
