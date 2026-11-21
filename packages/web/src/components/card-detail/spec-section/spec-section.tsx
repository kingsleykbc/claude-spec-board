import { useRef, useState, type ChangeEvent, type ClipboardEvent, type DragEvent } from 'react';
import { EditIcon, ImageIcon } from '@/lib/icons';
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
  /** Uploads an image; resolves to its relative path (`images/x.png`). Without it, images can't be added. */
  onUpload?: (file: File) => Promise<string>;
  /** An upload failed; the message is for the user. */
  onUploadError?: (message: string) => void;
}

const smallButton = 'h-7 cursor-pointer rounded-[7px] py-0 text-[12.5px]';

/** The SPEC section: rendered Markdown, or a split editor with live preview (prototype lines 172-183). */
export function SpecSection({ md, pid, baseDir, text, saving = false, onEdit, onChange, onCancel, onSave, onUpload, onUploadError }: SpecSectionProps) {
  const editing = text !== null;
  const box = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const latest = useRef(text);
  latest.current = text;
  const [uploading, setUploading] = useState(false);

  /** Uploads each image, then puts `![name](path)` at the cursor (replacing any selection). */
  const upload = async (files: File[]) => {
    if (!onUpload || files.length === 0) return;
    let at = { start: box.current?.selectionStart ?? latest.current?.length ?? 0, end: box.current?.selectionEnd ?? latest.current?.length ?? 0 };
    setUploading(true);
    try {
      for (const file of files) {
        const path = await onUpload(file);
        // Editing was cancelled while the upload ran: don't reopen the editor.
        if (latest.current === null) return;
        const cur = latest.current;
        const start = Math.min(at.start, cur.length);
        const end = Math.min(Math.max(at.end, start), cur.length);
        const alt = file.name.replace(/\.[^.]*$/, '').replace(/[[\]]/g, '');
        const md = `![${alt}](${path})`;
        latest.current = cur.slice(0, start) + md + cur.slice(end);
        onChange(latest.current);
        at = { start: start + md.length, end: start + md.length };
      }
    } catch (e) {
      onUploadError?.(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };
  const images = (list: FileList | File[] | null | undefined) => Array.from(list ?? []).filter((f) => f.type.startsWith('image/'));
  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = images(e.clipboardData.files);
    if (files.length === 0) return;
    e.preventDefault();
    void upload(files);
  };
  const onDrop = (e: DragEvent<HTMLTextAreaElement>) => {
    const files = images(e.dataTransfer.files);
    if (files.length === 0) return;
    e.preventDefault();
    void upload(files);
  };
  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const files = images(e.target.files);
    e.target.value = '';
    void upload(files);
  };
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
              ref={box}
              value={text}
              onChange={(e) => onChange(e.target.value)}
              onPaste={onPaste}
              onDrop={onDrop}
            />
            <div className="overflow-auto px-5 py-4">
              <Markdown md={text} size="sm" pid={pid} baseDir={baseDir} />
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-line px-3 py-2.5">
            {onUpload && (
              <>
                <input ref={picker} type="file" accept="image/*" className="hidden" tabIndex={-1} aria-hidden onChange={onPick} />
                <button
                  type="button"
                  className={`${smallButton} mr-auto flex items-center gap-1.5 border border-line bg-card px-3 text-fg hover:border-line2 disabled:cursor-default disabled:opacity-60`}
                  disabled={uploading}
                  onClick={() => picker.current?.click()}
                >
                  <ImageIcon aria-hidden /> {uploading ? 'Uploading…' : 'Add image'}
                </button>
              </>
            )}
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
