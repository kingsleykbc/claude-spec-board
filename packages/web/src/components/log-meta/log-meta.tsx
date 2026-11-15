import { formatTokens } from '@/lib/formatTokens';
import { fmtLogTime } from '@/lib/vm';
import { FileLink } from '@/state/fileLinks';

export function isHttpUrl(v: string): boolean {
  try {
    const p = new URL(v).protocol;
    return p === 'http:' || p === 'https:';
  } catch {
    return false;
  }
}

const label = 'text-[11px] font-semibold tracking-[0.08em] text-fg3';
const metaText = 'text-[12px] text-fg3';

export interface LogMetaProps {
  files: string[];
  commit: string | null;
  pr: string | null;
  tokens: number | null;
  /** When the subtask was done; the subtask log shows it, the logs window doesn't. */
  doneAt?: string | null | undefined;
}

/** What a log recorded besides its text: files changed, commit, PR, tokens. Shared by the subtask log and the logs window. */
export function LogMeta({ files, commit, pr, tokens, doneAt }: LogMetaProps) {
  const hasMeta = Boolean(commit || pr || doneAt || tokens !== null);
  return (
    <div className="flex flex-col gap-3">
      {files.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className={label}>FILES CHANGED</span>
          {files.map((f) => (
            <FileLink key={f} path={f} className="text-[12px] break-all text-fg2" />
          ))}
        </div>
      )}
      {hasMeta && (
        <div className="flex flex-col gap-1.5">
          {commit && <span className={label}>COMMIT</span>}
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5" data-testid="log-meta">
            {commit && <span className="self-start rounded-[5px] border border-line bg-code px-[7px] py-0.5 font-mono text-[12px]">{commit}</span>}
            {pr &&
              (isHttpUrl(pr) ? (
                <a className="text-[12px] font-semibold text-accent no-underline hover:text-accent hover:underline" href={pr} target="_blank" rel="noopener noreferrer">
                  PR
                </a>
              ) : (
                <span className={metaText}>{pr}</span>
              ))}
            {doneAt && <span className={metaText}>Done {fmtLogTime(doneAt)}</span>}
            {tokens !== null && <span className={metaText}>{formatTokens(tokens)} tokens</span>}
          </div>
        </div>
      )}
    </div>
  );
}
