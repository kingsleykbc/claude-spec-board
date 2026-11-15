import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api, ConflictError, type ReferenceDoc } from '@/api/client';
import { ESC, useEscape } from '@/lib/escape';
import { CaretLeftIcon, CaretRightIcon, CloseIcon, EditIcon, PlusIcon } from '@/lib/icons';
import { OFFLINE_TOAST } from '@/state/actions';
import { FileLink } from '@/state/fileLinks';
import type { PushToast } from '@/state/toasts';
import { ConflictDialog } from '@/components/conflict-dialog/conflict-dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog/confirm-dialog';
import { Markdown } from '@/components/ui/markdown/markdown';
import { Modal } from '@/components/ui/modal/modal';
import { DocSkeleton } from '@/components/ui/skeleton/skeleton';
import { useDiscardGuard } from '@/lib/use-discard-guard';
import { Hint } from '@/components/ui/hint/hint';

export type RefsClient = Pick<
  typeof api,
  'references' | 'saveReference' | 'linkReference' | 'createReference' | 'removeReference' | 'referenceDraftCopy' | 'files'
>;

export interface ReferencesModalProps {
  pid: string;
  client?: RefsClient;
  toast: PushToast;
  down?: boolean;
  /** Changes whenever the project reloads (a live update): the list is fetched again. */
  stamp?: unknown;
  onClose: () => void;
  /** Where focus goes on close when the opener is gone (a logo-menu item): the logo button. */
  returnFocus?: () => HTMLElement | null;
}

/** How long the link-path input waits before asking for suggestions. */
export const SUGGEST_MS = 150;

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
/** "deploy" → "DEPLOY.md" (the prototype's newName). */
export const newDocName = (input: string) => (input.trim() || 'NEW-DOC').replace(/\.md$/i, '').toUpperCase() + '.md';
/** The server's rule for a new document name (after trimming, dropping `.md` and uppercasing). */
export const validDocName = (input: string) => /^[A-Z0-9][A-Z0-9._-]*$/.test(newDocName(input).slice(0, -3));
const baseName =(p: string) => p.split('/').pop() ?? p;

type AddStep = 'menu' | 'link' | 'new';
interface Edit {
  path: string;
  text: string;
}

/** Reference documents (pinned behaviour 18; prototype lines 321-367 and 752-767). */
export function ReferencesModal({ pid, client = api, toast, down = false, stamp, onClose, returnFocus }: ReferencesModalProps) {
  const [refs, setRefs] = useState<ReferenceDoc[] | null>(null);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [edit, setEdit] = useState<Edit | null>(null);
  /** md and hash of the document when editing began: saves are checked against this hash. */
  const editBase = useRef<{ md: string; hash: string }>({ md: '', hash: '' });
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [add, setAdd] = useState<AddStep | null>(null);
  const [input, setInput] = useState('');
  const [suggest, setSuggest] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  /** Set synchronously, so a second click before the re-render does nothing. */
  const inFlight = useRef(false);
  const [removeAsk, setRemoveAsk] = useState<ReferenceDoc | null>(null);
  const tabsRef = useRef<HTMLDivElement | null>(null);
  const [arrows, setArrows] = useState({ l: false, r: false });

  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );

  /** Fetch the list; returns it (or null on failure, keeping the previous list). */
  const load = useCallback(async (): Promise<ReferenceDoc[] | null> => {
    try {
      const list = await client.references(pid);
      if (alive.current) setRefs(list);
      return list;
    } catch (e) {
      if (alive.current) toast('err', 'Couldn’t load reference documents', message(e));
      return null;
    }
  }, [client, pid, toast]);

  useEffect(() => {
    void load();
  }, [load, stamp]);

  const list = refs ?? [];
  const active = list.find((r) => r.path === activePath) ?? list[0] ?? null;
  const editing = edit !== null && active !== null && edit.path === active.path;
  const dirty = editing && edit.text !== editBase.current.md;

  const { requestClose, guard, dialog: discardDialog } = useDiscardGuard({
    editing,
    dirty,
    what: 'this document',
    onLeave: () => setEdit(null),
    onClose,
  });

  // The add menu is its own Esc layer, above the editor and the modal (pinned behaviour 14).
  useEscape(add !== null, () => setAdd(null), ESC.refAdd);

  // Link suggestions: project .md files matching the input, minus those already linked.
  useEffect(() => {
    if (add !== 'link') return;
    let live = true;
    const t = setTimeout(() => {
      client
        .files(pid, input.trim())
        .then((files) => {
          if (live) setSuggest(files.filter((f) => !list.some((r) => r.path === f)));
        })
        .catch(() => {
          if (live) setSuggest([]);
        });
    }, SUGGEST_MS);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // `list` changes identity on every load; the linked paths are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [add, input, pid, client, list.map((r) => r.path).join('\n')]);

  // Tab overflow arrows (the prototype's checkTabs, line 572).
  const checkTabs = useCallback(() => {
    const el = tabsRef.current;
    if (!el) return;
    const l = el.scrollLeft > 4;
    const r = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setArrows((a) => (a.l === l && a.r === r ? a : { l, r }));
  }, []);
  useLayoutEffect(checkTabs, [checkTabs, refs]);
  useEffect(() => {
    window.addEventListener('resize', checkTabs);
    return () => window.removeEventListener('resize', checkTabs);
  }, [checkTabs]);
  const scrollTabs = (dx: number) => tabsRef.current?.scrollBy?.({ left: dx });

  const offline = () => toast('err', ...OFFLINE_TOAST);

  const openAdd = () => {
    setAdd((a) => (a ? null : 'menu'));
    setInput('');
    setSuggest([]);
  };
  const back = () => {
    setAdd('menu');
    setInput('');
    setSuggest([]);
  };

  const startEdit = (doc: ReferenceDoc, text = doc.md) => {
    editBase.current = { md: doc.md, hash: doc.hash };
    setEdit({ path: doc.path, text });
  };

  const link = async (raw: string) => {
    const p = raw.trim();
    if (!p || inFlight.current) return;
    if (down) return offline();
    inFlight.current = true;
    setBusy(true);
    try {
      const res = await client.linkReference(pid, p);
      await load();
      if (!alive.current) return;
      setAdd(null);
      setInput('');
      setEdit(null);
      setActivePath(res.path);
      toast('ok', `Linked ${baseName(res.path)}`, res.path);
    } catch (e) {
      toast('err', `Couldn’t link ${p}`, message(e));
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  };

  const create = async () => {
    if (inFlight.current || !validDocName(input)) return;
    if (down) return offline();
    const name = newDocName(input);
    inFlight.current = true;
    setBusy(true);
    try {
      const res = await client.createReference(pid, input.trim() || 'NEW-DOC');
      const fresh = await load();
      if (!alive.current) return;
      setAdd(null);
      setInput('');
      setActivePath(res.path);
      const doc = fresh?.find((r) => r.path === res.path);
      if (doc) startEdit(doc);
      else setEdit(null);
      toast('ok', `Created ${baseName(res.path)}`, res.path);
    } catch (e) {
      toast('err', `Couldn’t create docs/${name}`, message(e));
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  };

  const remove = async (doc: ReferenceDoc) => {
    if (down) {
      setRemoveAsk(null);
      return offline();
    }
    setRemoveAsk(null);
    try {
      await client.removeReference(pid, doc.path);
    } catch (e) {
      toast('err', `Couldn’t remove ${doc.name}`, message(e));
      return;
    }
    if (!alive.current) return;
    // Drop it locally now and pick the next tab from the list without it, so a failed refetch
    // never brings the removed doc back.
    const left = (refs ?? []).filter((r) => r.path !== doc.path);
    setRefs((cur) => (cur ? cur.filter((r) => r.path !== doc.path) : cur));
    setActivePath(left[0]?.path ?? null);
    setEdit(null);
    void load();
    toast('ok', `Removed ${doc.name} from references`, 'The file was not deleted.');
  };

  const save = async () => {
    if (!editing || !active || saving) return;
    if (down) return offline();
    const text = edit.text;
    setSaving(true);
    try {
      await client.saveReference(pid, active.path, editBase.current.hash, text);
    } catch (e) {
      if (alive.current) setSaving(false);
      if (e instanceof ConflictError) setConflict(true);
      else toast('err', `Couldn’t save ${active.name}`, message(e));
      return;
    }
    await load();
    if (!alive.current) return;
    setSaving(false);
    setEdit(null);
    toast('ok', `Saved ${active.name}`, active.path);
  };

  const reloadKeepCopy = async () => {
    if (!editing || !active) return;
    if (down) return offline();
    let copy: string;
    try {
      copy = (await client.referenceDraftCopy(pid, active.path, edit.text)).path;
    } catch (e) {
      toast('err', 'Couldn’t save your copy', message(e));
      return;
    }
    setConflict(false);
    setEdit(null);
    await load();
    toast('ok', 'Reloaded latest version', `Your text is saved as ${copy}`);
  };

  /** Keep the text and the original base hash (no rebase): the next Save conflicts again if the file really changed. */
  const keepEditing = () => {
    setConflict(false);
    void load();
  };

  const reload = () => {
    setConflict(false);
    setEdit(null);
    void load();
    toast('info', 'Reloaded latest version', 'Your unsaved changes were discarded.');
  };

  const pickTab = (doc: ReferenceDoc) => {
    if (active && doc.path === active.path) return;
    guard(() => {
      setEdit(null);
      setActivePath(doc.path);
    });
  };

  return (
    <Modal label="Reference documents" width="min(820px, 100%)" height="min(680px, calc(100vh - 64px))" onClose={requestClose} returnFocus={returnFocus}>
      <div className="flex items-center gap-2.5 pt-[18px] pr-5 pb-3.5 pl-7">
        <span className="text-[15px] font-semibold tracking-[0.06em]">REFERENCE DOCUMENTS</span>
        <span className="flex-1" />
        <div className="relative">
          <button type="button" className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-line2 bg-card px-3 py-0 text-[13px] font-semibold text-fg hover:bg-panel" aria-expanded={add !== null} onClick={openAdd}>
            <PlusIcon aria-hidden /> Add
          </button>
          {add && (
            <div className="absolute top-10 right-0 z-[6] w-[330px] rounded-xl border border-line bg-card p-1.5 shadow-lg">
              {add === 'menu' && (
                <div className="flex flex-col gap-0.5">
                  <button type="button" className="flex cursor-pointer flex-col gap-0.5 rounded-lg border-0 bg-transparent px-3 py-2.5 text-left text-fg hover:bg-panel" onClick={() => setAdd('link')}>
                    <span className="text-[13.5px] font-semibold">Link an existing file</span>
                    <span className="text-[12.5px] text-fg2">Pick a Markdown file already in the project</span>
                  </button>
                  <button type="button" className="flex cursor-pointer flex-col gap-0.5 rounded-lg border-0 bg-transparent px-3 py-2.5 text-left text-fg hover:bg-panel" onClick={() => setAdd('new')}>
                    <span className="text-[13.5px] font-semibold">Create a new document</span>
                    <span className="text-[12.5px] text-fg2">Starts an empty file in docs/</span>
                  </button>
                </div>
              )}
              {add === 'link' && (
                <form
                  className="flex flex-col gap-2 p-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void link(input);
                  }}
                >
                  <label className="text-[12px] font-semibold text-fg2" htmlFor="rf-link">
                    File path
                  </label>
                  <input
                    id="rf-link"
                    className="h-[34px] rounded-lg border border-line2 bg-card px-2.5 py-0 font-mono text-[12.5px] text-fg"
                    autoFocus
                    placeholder="docs/ARCHITECTURE.md"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                  />
                  <div className="flex flex-col">
                    {suggest.map((p) => (
                      <button key={p} type="button" className="cursor-pointer rounded-md border-0 bg-transparent px-2 py-1.5 text-left font-mono text-[12px] text-fg2 hover:bg-panel hover:text-fg" onClick={() => void link(p)}>
                        {p}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-end gap-1.5">
                    <button type="button" className="h-[30px] cursor-pointer rounded-[7px] border border-line bg-card px-3 py-0 text-[12.5px] text-fg" onClick={back}>
                      Back
                    </button>
                    <button type="submit" className="h-[30px] cursor-pointer rounded-[7px] border-0 bg-accent px-3 py-0 text-[12.5px] font-semibold text-accent-fg disabled:cursor-default disabled:opacity-45" disabled={busy || input.trim() === ''}>
                      Link file
                    </button>
                  </div>
                </form>
              )}
              {add === 'new' && (
                <form
                  className="flex flex-col gap-2 p-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void create();
                  }}
                >
                  <label className="text-[12px] font-semibold text-fg2" htmlFor="rf-new">
                    Document name
                  </label>
                  <input id="rf-new" className="h-[34px] rounded-lg border border-line2 bg-card px-2.5 py-0 font-mono text-[12.5px] text-fg" autoFocus placeholder="DEPLOY.md" value={input} onChange={(e) => setInput(e.target.value)} />
                  {validDocName(input) ? (
                    <span className="text-[12px] text-fg3">Saved as docs/{newDocName(input)}</span>
                  ) : (
                    <span className="text-[12px] text-block-ink" role="alert">
                      Use letters, numbers, dots, dashes or underscores
                    </span>
                  )}
                  <div className="flex justify-end gap-1.5">
                    <button type="button" className="h-[30px] cursor-pointer rounded-[7px] border border-line bg-card px-3 py-0 text-[12.5px] text-fg" onClick={back}>
                      Back
                    </button>
                    <button type="submit" className="h-[30px] cursor-pointer rounded-[7px] border-0 bg-accent px-3 py-0 text-[12.5px] font-semibold text-accent-fg disabled:cursor-default disabled:opacity-45" disabled={busy || !validDocName(input)}>
                      Create
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
        <Hint label="Close">
          <button
            type="button"
            className="flex size-[34px] cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent p-0 text-[18px] text-fg2 hover:bg-panel"
            aria-label="Close"
            onClick={requestClose}
          >
            <CloseIcon aria-hidden />
          </button>
        </Hint>
      </div>
      <div className="relative mx-7 flex items-stretch border-b border-line">
        {arrows.l && (
          <Hint label="Scroll tabs left">
            <button
              type="button"
              className="flex w-7 flex-none cursor-pointer items-center justify-center border-0 bg-card p-0 text-[16px] text-fg2"
              aria-label="Scroll tabs left"
              onClick={() => scrollTabs(-200)}
            >
              <CaretLeftIcon aria-hidden />
            </button>
          </Hint>
        )}
        <div ref={tabsRef} className="flex min-w-0 flex-1 gap-0.5 overflow-x-auto scroll-smooth [scrollbar-width:none]" role="tablist" onScroll={checkTabs}>
          {list.map((r) => (
            <button key={r.path} type="button" role="tab" title={r.path} aria-selected={active?.path === r.path} className="h-[38px] min-w-[132px] flex-none cursor-pointer border-b-2 border-transparent bg-transparent px-4 py-0 font-mono text-[12.5px] font-normal text-fg2 hover:text-fg aria-selected:border-b-accent aria-selected:font-semibold aria-selected:text-fg" onClick={() => pickTab(r)}>
              {r.name}
            </button>
          ))}
        </div>
        {arrows.r && (
          <Hint label="Scroll tabs right">
            <button
              type="button"
              className="flex w-8 flex-none cursor-pointer items-center justify-center border-l border-line bg-card p-0 text-[17px] text-fg"
              aria-label="Scroll tabs right"
              onClick={() => scrollTabs(200)}
            >
              <CaretRightIcon aria-hidden />
            </button>
          </Hint>
        )}
      </div>
      {editing ? (
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <textarea
            className="resize-none border-r border-line bg-code px-[22px] py-[18px] font-mono text-[12.5px] leading-[1.7] text-fg outline-none"
            aria-label="Document markdown"
            spellCheck={false}
            value={edit.text}
            onChange={(e) => setEdit({ path: edit.path, text: e.target.value })}
          />
          <div className="overflow-auto px-[22px] py-[18px]">
            <Markdown md={edit.text} size="sm" />
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto px-7 py-5" role="tabpanel">
          {active ? (
            <>
              <div className="mb-3.5 font-mono text-[11.5px] text-fg3" data-testid="ref-path">
                <FileLink path={active.path} />
              </div>
              {active.missing ? (
                <p className="my-[1em] text-[14px] text-block-ink">File not found</p>
              ) : (
                <div className="max-w-[70ch]">
                  <Markdown md={active.md} />
                </div>
              )}
            </>
          ) : (
            refs ? <p className="my-[1em] text-[14px] text-fg2">No reference documents yet. Use Add to link a file or create one.</p> : <DocSkeleton label='Loading reference documents…' />
          )}
        </div>
      )}
      <div className="flex items-center gap-2 border-t border-line pt-3 pr-5 pb-3.5 pl-7">
        {editing ? (
          <>
            <span className="text-[12px] text-fg3">
              Editing <FileLink path={active.path} />
            </span>
            <span className="flex-1" />
            <button type="button" className="h-8 cursor-pointer rounded-lg border border-line bg-card px-3.5 py-0 text-[13px] text-fg" onClick={() => setEdit(null)}>
              Cancel
            </button>
            <button type="button" className="h-8 cursor-pointer rounded-lg border-0 bg-accent px-3.5 py-0 text-[13px] font-semibold text-accent-fg enabled:hover:bg-accent-hover disabled:cursor-default disabled:opacity-45" disabled={saving} onClick={() => void save()}>
              Save
            </button>
          </>
        ) : (
          active && (
            <>
              <button type="button" className="h-8 cursor-pointer rounded-[7px] border-0 bg-transparent px-2.5 py-0 text-[12.5px] text-fg2 hover:bg-panel hover:text-block-ink" onClick={() => setRemoveAsk(active)}>
                Remove from list
              </button>
              <span className="flex-1" />
              {!active.missing && (
                <button type="button" className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-line2 bg-card px-3.5 py-0 text-[13px] font-semibold text-fg hover:bg-panel" onClick={() => startEdit(active)}>
                  <EditIcon aria-hidden /> Edit
                </button>
              )}
            </>
          )
        )}
      </div>
      {conflict && editing && (
        <ConflictDialog title="This document changed outside the board" path={active.path} onKeepEditing={keepEditing} onReloadKeepCopy={() => void reloadKeepCopy()} onReload={reload} />
      )}
      {removeAsk && (
        <ConfirmDialog
          title={`Remove ${removeAsk.name} from references?`}
          body="This removes the link only. The file stays in your project and you can link it again later."
          path={removeAsk.path}
          onDismiss={() => setRemoveAsk(null)}
          actions={[
            { label: 'Cancel', onClick: () => setRemoveAsk(null) },
            { label: 'Remove link', kind: 'danger', onClick: () => void remove(removeAsk) },
          ]}
        />
      )}
      {discardDialog}
    </Modal>
  );
}
