import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import type { Spec } from '@specboard/core';
import { api } from '@/api/client';
import { OFFLINE_TOAST } from '@/state/actions';
import type { PushToast } from '@/state/toasts';
import { ImageIcon, TrashIcon } from '@/lib/icons';
import { specImageDir } from '@/lib/image-src';
import { cn } from '@/lib/utils';
import { Modal, ModalClose } from '@/components/ui/modal/modal';
import { section, sectionHead, sectionLabel } from '../section';

// Images in the spec's images/ folder that the spec text doesn't use. Claude is told to look at them.

export type AttachmentClient = Pick<typeof api, 'uploadImage' | 'deleteImage'>;

export interface AttachmentsProps {
  pid: string;
  spec: Spec;
  client?: AttachmentClient;
  /** Reloads the project so the new list shows (the server works out `attachments`). */
  refresh: () => Promise<void>;
  toast: PushToast;
  down?: boolean;
}

/** The same extensions the server accepts (core IMAGE_EXTS). */
const EXT = /\.(png|jpe?g|gif|webp|svg|avif)$/i;
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const smallButton = 'h-7 cursor-pointer rounded-[7px] py-0 text-[12.5px]';

export function Attachments({ pid, spec, client = api, refresh, toast, down = false }: AttachmentsProps) {
  const id = spec.id;
  const readOnly = spec.archived;
  const picker = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [view, setView] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  if (readOnly && spec.attachments.length === 0) return null;

  const dir = specImageDir(spec.dir);
  // The name is a raw file name (it may hold %, # or ?), so encode the whole project-relative path.
  const url = (name: string) => (dir === undefined ? `images/${name}` : `/api/projects/${encodeURIComponent(pid)}/image?path=${encodeURIComponent(`${dir}/images/${name}`)}`);

  const upload = async (all: File[]) => {
    if (all.length === 0) return;
    if (down) return toast('err', ...OFFLINE_TOAST);
    const files = all.filter((f) => f.type.startsWith('image/') && EXT.test(f.name));
    if (files.length < all.length) toast('err', 'Couldn’t add the image', 'Only PNG, JPG, GIF, WebP, SVG or AVIF images can be added.');
    if (files.length === 0) return;
    setUploading(true);
    try {
      for (const file of files) await client.uploadImage(pid, id, file);
    } catch (e) {
      toast('err', 'Couldn’t add the image', message(e));
    } finally {
      setUploading(false);
    }
    await refresh();
  };
  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    void upload(files);
  };
  const onDrop = (e: DragEvent<HTMLElement>) => {
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    e.preventDefault();
    void upload(files);
  };
  const remove = async (name: string) => {
    setConfirm(null);
    if (down) return toast('err', ...OFFLINE_TOAST);
    try {
      await client.deleteImage(pid, id, name);
    } catch (e) {
      toast('err', `Couldn’t delete ${name}`, message(e));
    }
    await refresh();
  };

  return (
    <section
      data-section="attachments"
      data-dragging={dragging}
      aria-label="Attachments"
      className={cn(section, 'data-[dragging=true]:border-accent')}
      {...(readOnly
        ? {}
        : {
            onDragOver: (e: DragEvent<HTMLElement>) => {
              if (!Array.from(e.dataTransfer.types).includes('Files')) return;
              e.preventDefault();
              setDragging(true);
            },
            onDragLeave: () => setDragging(false),
            onDrop,
          })}
    >
      <div className={`${sectionHead} pr-3`}>
        <span className={sectionLabel}>ATTACHMENTS</span>
        <span className="flex-1" />
        {!readOnly && (
          <>
            <input ref={picker} type="file" accept="image/*" multiple className="hidden" tabIndex={-1} aria-hidden data-testid="attachment-input" onChange={onPick} />
            <button
              type="button"
              className={`${smallButton} flex items-center gap-1.5 border border-line bg-card px-3 text-fg hover:border-line2 disabled:cursor-default disabled:opacity-60`}
              disabled={uploading}
              onClick={() => picker.current?.click()}
            >
              <ImageIcon aria-hidden /> {uploading ? 'Uploading…' : 'Add image'}
            </button>
          </>
        )}
      </div>
      {spec.attachments.length === 0 ? (
        <div className="px-4 py-[18px] text-[13.5px] text-fg3">No attachments. Add images Claude should look at.</div>
      ) : (
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3 p-4">
          {spec.attachments.map((name) => (
            <li key={name} data-attachment={name} className="flex min-w-0 flex-col gap-1.5">
              <button
                type="button"
                className="flex h-[96px] cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-line bg-panel p-0 hover:border-line2"
                aria-label={`View ${name}`}
                onClick={() => setView(name)}
              >
                <img src={url(name)} alt="" className="max-h-full max-w-full object-contain" />
              </button>
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="min-w-0 flex-1 truncate text-[12px] text-fg2" title={name}>
                  {name}
                </span>
                {!readOnly &&
                  (confirm === name ? (
                    <span className="flex flex-none items-center gap-1.5 text-[12px]" role="group" aria-label={`Delete ${name}?`}>
                      <span className="text-fg2">Delete?</span>
                      <button type="button" className="cursor-pointer border-0 bg-transparent p-0 text-[12px] font-semibold text-block-ink underline" onClick={() => void remove(name)}>
                        Yes
                      </button>
                      <button type="button" className="cursor-pointer border-0 bg-transparent p-0 text-[12px] text-fg2 underline" autoFocus onClick={() => setConfirm(null)}>
                        No
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="flex size-6 flex-none cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 text-fg2 hover:bg-panel hover:text-fg"
                      aria-label={`Delete ${name}`}
                      onClick={() => setConfirm(name)}
                    >
                      <TrashIcon aria-hidden />
                    </button>
                  ))}
              </div>
            </li>
          ))}
        </ul>
      )}
      {view !== null && (
        <Modal label={view} width="min(900px, 100%)" height="auto" onClose={() => setView(null)}>
          <ModalClose onClick={() => setView(null)} />
          <div className="flex max-h-[calc(100vh-64px)] flex-col gap-3 overflow-auto p-5 pr-[60px]">
            <h2 className="m-0 truncate text-[14px] font-semibold">{view}</h2>
            <img src={url(view)} alt={view} className="max-h-[calc(100vh-180px)] max-w-full self-center object-contain" />
          </div>
        </Modal>
      )}
    </section>
  );
}
