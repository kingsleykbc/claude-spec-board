import { WarnIcon } from '@/lib/icons';
import { FileLink } from '@/state/fileLinks';

export interface FileProblemProps {
  /** `spec.problems[0]`. */
  message: string;
  /** Project-relative path of the spec file. */
  path: string;
  onFix: () => void;
}

/** Warning panel for a spec file that does not parse cleanly (prototype lines 161-169). */
export function FileProblem({ message, path, onFix }: FileProblemProps) {
  return (
    <div role="alert" className="flex flex-none gap-3 rounded-[10px] border border-review bg-review-soft px-4 py-3.5">
      <WarnIcon aria-hidden className="mt-px text-[16px] text-review-ink" />
      <div className="flex min-w-0 flex-1 flex-col gap-1 text-[13.5px] leading-[1.5]">
        <span className="font-semibold">This spec file has a formatting problem</span>
        <span className="text-fg2">{message}</span>
        <FileLink path={path} className="text-[12px] wrap-anywhere text-fg2" />
      </div>
      <button
        type="button"
        className="h-[30px] cursor-pointer self-start rounded-[7px] border border-line2 bg-card px-3 py-0 text-[12.5px] font-semibold whitespace-nowrap text-fg"
        onClick={onFix}
      >
        Ask Claude to fix
      </button>
    </div>
  );
}
