import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api, ConflictError, type ReferenceDoc } from '../api/client';
import { ESC, useEscape } from '../lib/escape';
import { OFFLINE_TOAST } from '../state/actions';
import type { PushToast } from '../state/toasts';
import { ConflictDialog } from './ConflictDialog';
import { Dialog } from './Dialog';
import { Markdown } from './Markdown';
import { Modal } from './Modal';
import { useDiscardGuard } from './useDiscardGuard';
import s from './modals.module.css';

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
export function ReferencesModal({ pid, client = api, toast, down = false, stamp, onClose }: ReferencesModalProps) {
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
    <Modal label="Reference documents" width="min(820px, 100%)" height="min(680px, calc(100vh - 64px))" onClose={requestClose}>
      <div className={s.rfHead}>
        <span className={s.rfTitle}>REFERENCE DOCUMENTS</span>
        <span className={s.grow} />
        <div className={s.rfAddWrap}>
          <button type="button" className={s.rfAdd} aria-expanded={add !== null} onClick={openAdd}>
            + Add
          </button>
          {add && (
            <div className={s.rfMenu}>
              {add === 'menu' && (
                <div className={s.rfMenuList}>
                  <button type="button" className={s.rfMenuItem} onClick={() => setAdd('link')}>
                    <span className={s.rfMenuMain}>Link an existing file</span>
                    <span className={s.rfMenuSub}>Pick a Markdown file already in the project</span>
                  </button>
                  <button type="button" className={s.rfMenuItem} onClick={() => setAdd('new')}>
                    <span className={s.rfMenuMain}>Create a new document</span>
                    <span className={s.rfMenuSub}>Starts an empty file in docs/</span>
                  </button>
                </div>
              )}
              {add === 'link' && (
                <form
                  className={s.rfForm}
                  onSubmit={(e) => {
                    e.preventDefault();
                    void link(input);
                  }}
                >
                  <label className={s.rfLabel} htmlFor="rf-link">
                    File path
                  </label>
                  <input
                    id="rf-link"
                    className={s.rfInput}
                    autoFocus
                    placeholder="docs/ARCHITECTURE.md"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                  />
                  <div className={s.rfSuggest}>
                    {suggest.map((p) => (
                      <button key={p} type="button" className={s.rfSuggestItem} onClick={() => void link(p)}>
                        {p}
                      </button>
                    ))}
                  </div>
                  <div className={s.rfFormBtns}>
                    <button type="button" className={s.rfBack} onClick={back}>
                      Back
                    </button>
                    <button type="submit" className={s.rfConfirm} disabled={busy || input.trim() === ''}>
                      Link file
                    </button>
                  </div>
                </form>
              )}
              {add === 'new' && (
                <form
                  className={s.rfForm}
                  onSubmit={(e) => {
                    e.preventDefault();
                    void create();
                  }}
                >
                  <label className={s.rfLabel} htmlFor="rf-new">
                    Document name
                  </label>
                  <input id="rf-new" className={s.rfInput} autoFocus placeholder="DEPLOY.md" value={input} onChange={(e) => setInput(e.target.value)} />
                  {validDocName(input) ? (
                    <span className={s.rfHint}>Saved as docs/{newDocName(input)}</span>
                  ) : (
                    <span className={s.rfError} role="alert">
                      Use letters, numbers, dots, dashes or underscores
                    </span>
                  )}
                  <div className={s.rfFormBtns}>
                    <button type="button" className={s.rfBack} onClick={back}>
                      Back
                    </button>
                    <button type="submit" className={s.rfConfirm} disabled={busy || !validDocName(input)}>
                      Create
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
        <button type="button" className={s.close} aria-label="Close" onClick={requestClose}>
          ×
        </button>
      </div>
      <div className={s.rfTabsRow}>
        {arrows.l && (
          <button type="button" className={s.rfArrowL} aria-label="Scroll tabs left" onClick={() => scrollTabs(-200)}>
            ‹
          </button>
        )}
        <div ref={tabsRef} className={s.rfTabs} role="tablist" onScroll={checkTabs}>
          {list.map((r) => (
            <button key={r.path} type="button" role="tab" title={r.path} aria-selected={active?.path === r.path} className={s.rfTab} onClick={() => pickTab(r)}>
              {r.name}
            </button>
          ))}
        </div>
        {arrows.r && (
          <button type="button" className={s.rfArrowR} aria-label="Scroll tabs right" onClick={() => scrollTabs(200)}>
            ›
          </button>
        )}
      </div>
      {editing ? (
        <div className={s.rfSplit}>
          <textarea
            className={s.rfTextarea}
            aria-label="Document markdown"
            spellCheck={false}
            value={edit.text}
            onChange={(e) => setEdit({ path: edit.path, text: e.target.value })}
          />
          <div className={s.rfPreview}>
            <Markdown md={edit.text} size="sm" />
          </div>
        </div>
      ) : (
        <div className={s.rfView} role="tabpanel">
          {active ? (
            <>
              <div className={s.rfPath} data-testid="ref-path">
                {active.path}
              </div>
              {active.missing ? (
                <p className={s.rfMissing}>File not found</p>
              ) : (
                <div className={s.rfDoc}>
                  <Markdown md={active.md} />
                </div>
              )}
            </>
          ) : (
            refs && <p className={s.rfNone}>No reference documents yet. Use + Add to link a file or create one.</p>
          )}
        </div>
      )}
      <div className={s.rfFoot}>
        {editing ? (
          <>
            <span className={s.rfEditing}>Editing {active.path}</span>
            <span className={s.grow} />
            <button type="button" className={s.rfCancel} onClick={() => setEdit(null)}>
              Cancel
            </button>
            <button type="button" className={s.rfSave} disabled={saving} onClick={() => void save()}>
              Save
            </button>
          </>
        ) : (
          active && (
            <>
              <button type="button" className={s.rfRemove} onClick={() => setRemoveAsk(active)}>
                Remove from list
              </button>
              <span className={s.grow} />
              {!active.missing && (
                <button type="button" className={s.rfEdit} onClick={() => startEdit(active)}>
                  ✎ Edit
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
        <Dialog
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
