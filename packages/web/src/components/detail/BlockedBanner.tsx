import s from './detail.module.css';

export interface BlockReason {
  key: string;
  text: string;
  onClick: () => void;
}

/** "Blocked." with clickable reasons, under the scrolling body (pinned behaviour 8; prototype lines 263-267). */
export function BlockedBanner({ reasons }: { reasons: BlockReason[] }) {
  return (
    <div className={s.bannerWrap}>
      <div role="status" className={s.banner}>
        <span className={s.bang}>!</span>
        <span className={s.blocked}>Blocked.</span>
        {reasons.map((r) => (
          <button key={r.key} type="button" className={s.reason} onClick={r.onClick}>
            {r.text}
          </button>
        ))}
      </div>
    </div>
  );
}
