import type { Urgency as UrgencyLevel } from '@specboard/core';
import { urgVm } from '@/lib/vm';

/** Three-bar urgency indicator with its label (prototype SpecCard.dc.html, urgency chip). */
export function Urgency({ level }: { level: UrgencyLevel }) {
  const u = urgVm(level);
  // Padding, colours, bar heights and weight come from the level, so they stay inline.
  return (
    <span className="inline-flex items-center gap-[5px] rounded-[5px]" title="Urgency" data-urgency={level} style={{ padding: u.pad, background: u.bg }}>
      <span className="flex h-[11px] items-end gap-[1.5px]">
        {u.bars.map((b, i) => (
          <span key={i} className="w-[3px] rounded-[1px]" style={{ height: b.h, background: b.c }} />
        ))}
      </span>
      <span className="text-[11.5px]" style={{ color: u.fg, fontWeight: u.weight }}>
        {u.label}
      </span>
    </span>
  );
}
