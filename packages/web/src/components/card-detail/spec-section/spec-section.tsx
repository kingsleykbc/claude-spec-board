import { EditIcon } from '@/lib/icons';
import { Markdown } from '@/components/ui/markdown/markdown';
import { section, sectionHead, sectionLabel } from '../section';

export interface SpecSectionProps {
  /** The saved spec body (`spec.bodyMd`). */
  md: string;
  /** The project, and the spec's project-relative folder, so `images/x.png` shows. */
  pid?: string;
  baseDir?: string | undefined;
  /** The text being edited, or null when not editing. */
  text: string | null;
  /** A save is in flight. */
  saving?: boolean;
  onEdit: () => void;
  onChange: (text: string) => void;
  onCancel: () => void;
  onSave: () => void;
}

const smallButton = 'h-7 cursor-pointer rounded-[7px] py-0 text-[12.5px]';

/** The SPEC section: rendered Markdown, or a split editor with live preview (prototype lines 172-183). */
export function SpecSection({ md, pid, baseDir, text, saving = false, onEdit, onChange, onCancel, onSave }: SpecSectionProps) {
  const editing = text !== null;
  return (
    <section className={section} data-section="spec" aria-label="Spec">
      <div className={`${sectionHead} pr-3`}>
        <span className={sectionLabel}>SPEC</span>
        <span className="flex-1" />
        {editing ? (
          <>
            <span className="text-[12px] text-fg3">Markdown · preview on the right</span>
          </>
        ) : (
          <button
            type="button"
            className={`${smallButton} flex items-center gap-1.5 border border-line bg-card px-2.5 font-medium text-fg hover:border-line2`}
            onClick={onEdit}
          >
            <EditIcon aria-hidden /> Edit
          </button>
        )}
      </div>
      {editing ? (
        <>
          <div className="grid min-h-[340px] grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <textarea
              className="min-h-[340px] resize-y border-0 border-r border-line bg-code px-[18px] py-4 font-mono text-[12.5px] leading-[1.7] text-fg outline-none"
              aria-label="Spec markdown"
              spellCheck={false}
              value={text}
              onChange={(e) => onChange(e.target.value)}
            />
            <div className="overflow-auto px-5 py-4">
              <Markdown md={text} size="sm" pid={pid} baseDir={baseDir} />
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-line px-3 py-2.5">
            <button type="button" className={`${smallButton} border border-line bg-card px-3 text-fg`} onClick={onCancel}>
              Cancel
            </button>
            <button
              type="button"
              className={`${smallButton} border-0 bg-accent px-3 font-semibold text-accent-fg hover:bg-accent-hover disabled:cursor-default disabled:opacity-60`}
              disabled={saving}
              onClick={onSave}
            >
              Save
            </button>
          </div>
        </>
      ) : (
        <div className="max-w-[72ch] px-5 pt-[18px] pb-5">
          <Markdown md={md} pid={pid} baseDir={baseDir} />
        </div>
      )}
    </section>
  );
}
