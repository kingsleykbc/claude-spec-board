import type { Status } from '@specboard/core';
import { CaretIcon } from '@/lib/icons';
import { ORDER, ST } from '@/lib/vm';
import { ResponsiveMenu, ResponsiveMenuRadioGroup, ResponsiveMenuRadioItem } from '@/components/ui/responsive-menu/responsive-menu';

export interface StatusMenuProps {
  status: Status;
  /** Called with a status different from the current one. */
  onPick: (status: Status) => void;
}

/**
 * Status button and its menu (prototype lines 132-137, 690): notes "Current" and, on Done, "Approve".
 * A dropdown on wide screens and a bottom drawer on narrow ones; Esc and a click outside close it.
 */
export function StatusMenu({ status, onPick }: StatusMenuProps) {
  const st = ST[status];
  return (
    <ResponsiveMenu
      title="Status"
      align="end"
      contentClassName="w-[190px]"
      trigger={
        <button
          type="button"
          className="flex h-[34px] flex-none cursor-pointer items-center gap-[7px] rounded-lg border border-line py-0 pr-2.5 pl-[11px] text-[13px] font-semibold whitespace-nowrap"
          style={{ background: st.soft, color: st.ink }}
        >
          <span className="inline-flex text-[13px]">
            <st.icon aria-hidden />
          </span>
          {st.label}
          <CaretIcon aria-hidden className="text-[12px] opacity-70" />
        </button>
      }
    >
      <ResponsiveMenuRadioGroup
        value={status}
        onValueChange={(k) => {
          if (k !== status) onPick(k as Status);
        }}
      >
        {ORDER.map((k) => {
          const o = ST[k];
          const note = k === status ? 'Current' : k === 'done' ? 'Approve' : '';
          return (
            <ResponsiveMenuRadioItem key={k} value={k} indicator="none" className="gap-[9px] px-[9px]">
              <span className="inline-flex w-3.5 justify-center text-[13px]" style={{ color: o.ink }}>
                <o.icon aria-hidden className="size-[13px]" />
              </span>
              {o.label}
              {note && <span className="ml-auto text-[11.5px] text-fg3">{note}</span>}
            </ResponsiveMenuRadioItem>
          );
        })}
      </ResponsiveMenuRadioGroup>
    </ResponsiveMenu>
  );
}
