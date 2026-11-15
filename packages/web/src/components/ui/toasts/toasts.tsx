import { TOAST, type Toast } from '@/state/toasts';
import { CloseIcon } from '@/lib/icons';

export interface ToastsProps {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}

/** Bottom-left toast stack (prototype lines 390-396). */
export function Toasts({ toasts, onDismiss }: ToastsProps) {
  return (
    <div aria-live="polite" className="fixed bottom-5 left-5 z-[80] flex w-[min(360px,calc(100vw-40px))] flex-col gap-2">
      {toasts.map((t) => {
        const k = TOAST[t.kind];
        return (
          <div
            key={t.id}
            className="flex animate-[sbIn_0.22s_ease-out] items-start gap-2.5 rounded-[11px] border border-line bg-card py-[11px] pr-2.5 pl-3 font-sans text-fg shadow-lg"
            data-kind={t.kind}
          >
            {/* The icon's colours come from the kind. */}
            <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full text-[12px] font-bold" style={{ background: k.bg, color: k.fg }}>
              <k.icon aria-hidden />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-px">
              <span className="text-[13.5px] font-semibold">{t.text}</span>
              {t.sub ? <span className="text-[12.5px] leading-[1.45] text-fg2">{t.sub}</span> : null}
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              className="inline-flex h-[22px] w-[22px] cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 text-[15px] leading-none text-fg3 hover:bg-panel"
              onClick={() => onDismiss(t.id)}
            >
              <CloseIcon aria-hidden />
            </button>
          </div>
        );
      })}
    </div>
  );
}
