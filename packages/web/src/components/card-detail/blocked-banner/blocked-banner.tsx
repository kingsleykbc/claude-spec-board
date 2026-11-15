export interface BlockReason {
  key: string;
  text: string;
  onClick: () => void;
}

/** "Blocked." with clickable reasons, under the scrolling body (pinned behaviour 8; prototype lines 263-267). */
export function BlockedBanner({ reasons }: { reasons: BlockReason[] }) {
  return (
    <div className="border-t border-line px-7 pt-3 pb-4">
      <div
        role="status"
        className="flex flex-wrap items-center gap-3 rounded-[10px] border-[1.5px] border-block bg-block-soft px-3.5 py-2.5 text-[13.5px] text-block-ink"
      >
        <span className="flex size-5 flex-none items-center justify-center rounded-full bg-block text-[12px] font-bold text-card">!</span>
        <span className="font-semibold">Blocked.</span>
        {reasons.map((r) => (
          <button
            key={r.key}
            type="button"
            className="cursor-pointer border-0 bg-transparent p-0 text-left text-[13.5px] text-block-ink underline decoration-1 underline-offset-3"
            onClick={r.onClick}
          >
            {r.text}
          </button>
        ))}
      </div>
    </div>
  );
}
