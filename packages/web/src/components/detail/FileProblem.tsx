import s from './detail.module.css';

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
    <div role="alert" className={s.problem}>
      <span className={s.problemIcon}>⚠</span>
      <div className={s.problemText}>
        <span className={s.problemTitle}>This spec file has a formatting problem</span>
        <span className={s.problemMsg}>{message}</span>
        <span className={s.problemPath}>{path}</span>
      </div>
      <button type="button" className={s.fix} onClick={onFix}>
        Ask Claude to fix
      </button>
    </div>
  );
}
