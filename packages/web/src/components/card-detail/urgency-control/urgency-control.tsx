import type { Urgency } from '@specboard/core';
import { URG_KEYS, urgVm } from '@/lib/vm';

export interface UrgencyControlProps {
  value: Urgency;
  /** Called with an urgency different from the current one. */
  onPick: (u: Urgency) => void;
}

/** Segmented Low / Normal / High / Urgent control (prototype lines 140-142, 691). */
export function UrgencyControl({ value, onPick }: UrgencyControlProps) {
  return (
    <div role="radiogroup" aria-label="Urgency" className="flex gap-0.5 rounded-lg bg-panel p-0.5">
      {URG_KEYS.map((k) => {
        const u = urgVm(k);
        return (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={k === value}
            className="flex h-[26px] cursor-pointer items-center gap-1.5 rounded-md border border-transparent bg-transparent px-[9px] py-0 text-[12.5px] aria-checked:border-line2 aria-checked:bg-card"
            // Colour and weight come from the urgency level.
            style={{ color: u.fg, fontWeight: u.weight }}
            onClick={() => {
              if (k !== value) onPick(k);
            }}
          >
            <span className="flex h-[11px] items-end gap-[1.5px]">
              {u.bars.map((b, i) => (
                <span key={i} className="w-[3px] rounded-[1px]" style={{ height: b.h, background: b.c }} />
              ))}
            </span>
            {u.label}
          </button>
        );
      })}
    </div>
  );
}
