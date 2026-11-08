import { Markdown } from '../Markdown';
import s from './detail.module.css';

export interface SpecSectionProps {
  /** The saved spec body (`spec.bodyMd`). */
  md: string;
  /** The text being edited, or null when not editing. */
  text: string | null;
  /** A save is in flight. */
  saving?: boolean;
  onEdit: () => void;
  onChange: (text: string) => void;
  onCancel: () => void;
  onSave: () => void;
}

/** The SPEC section: rendered Markdown, or a split editor with live preview (prototype lines 172-183). */
export function SpecSection({ md, text, saving = false, onEdit, onChange, onCancel, onSave }: SpecSectionProps) {
  const editing = text !== null;
  return (
    <section className={s.section} data-section="spec" aria-label="Spec">
      <div className={s.sectionHead}>
        <span className={s.label}>SPEC</span>
        <span className={s.grow} />
        {editing ? (
          <>
            <span className={s.hint}>Markdown · preview on the right</span>
            <button type="button" className={s.cancel} onClick={onCancel}>
              Cancel
            </button>
            <button type="button" className={s.save} disabled={saving} onClick={onSave}>
              Save
            </button>
          </>
        ) : (
          <button type="button" className={s.edit} onClick={onEdit}>
            ✎ Edit
          </button>
        )}
      </div>
      {editing ? (
        <div className={s.split}>
          <textarea className={s.textarea} aria-label="Spec markdown" spellCheck={false} value={text} onChange={(e) => onChange(e.target.value)} />
          <div className={s.preview}>
            <Markdown md={text} size="sm" />
          </div>
        </div>
      ) : (
        <div className={s.view}>
          <Markdown md={md} />
        </div>
      )}
    </section>
  );
}
