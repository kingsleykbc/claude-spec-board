import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Spec, Status, Urgency } from '@specboard/core';
import { api, ConflictError, type SpecWrite } from '../../api/client';
import { OFFLINE_TOAST, type Mutate } from '../../state/actions';
import { useSimple } from '../../state/simpleMode';
import type { PushToast } from '../../state/toasts';
import { ESC, useEscape } from '../../lib/escape';
import { blockTexts, relPath, runHold } from '../../lib/vm';
import { ConflictDialog } from '../ConflictDialog';
import { Modal } from '@/components/ui/modal/modal';
import { useDiscardGuard } from '@/lib/use-discard-guard';
import { BlockedBanner, type BlockReason } from './BlockedBanner';
import { Dependencies } from './Dependencies';
import { DetailHeader } from './DetailHeader';
import { FileProblem } from './FileProblem';
import type { RunState } from './RunButton';
import { Questions } from './Questions';
import { SpecSection } from './SpecSection';
import { Subtasks } from './Subtasks';
import s from './detail.module.css';

/** The detail footer: 'Created <date> · Updated <date>', leaving out what the spec lacks; null when it has neither. */
export function datesLine(created: string | null, updated: string | null): string | null {
  const parts = [created && `Created ${created}`, updated && `Updated ${updated}`].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

export type DetailClient = Pick<typeof api, 'setMeta' | 'setBody' | 'specDraftCopy' | 'setAnswers' | 'setSubtask'>;

export interface CardDetailProps {
  pid: string;
  specId: string;
  /** Project root, to show paths relative to it. */
  root: string;
  /** Active specs (with any optimistic status applied) and archived specs. */
  specs: Spec[];
  archived: Spec[];
  client?: DetailClient;
  /** The per-spec mutator every write goes through (Review Focus 3). */
  mutate: Mutate;
  refresh: () => Promise<void>;
  toast: PushToast;
  /** The board's move action (same toasts as a drag). */
  onMove: (spec: Spec, status: Status) => void | Promise<void>;
  onClose: () => void;
  /** Disconnected from the server: edits are refused with a toast. */
  down?: boolean;
  /** Run button state. */
  runState?: RunState;
  /** The spec Claude is working on, for the disabled Run note. */
  runningId?: string | null;
  /** In the fallback: what a registered project has to do with it. */
  runBlockedNote?: string | undefined;
  /** The disabled Run note when the active run has no spec to name (a project-level sync). */
  runBusyNote?: string | undefined;
  /** A run is working on this spec (the subtask "In progress" pill). */
  runActive?: boolean;
  onRun?: () => void;
  onStop?: () => void;
  /** "Ask Claude to fix" on a file problem. */
  onFixFile?: () => void;
  /** The header's Sync (this spec against the code); no button without it. */
  onSync?: () => void;
  /** A sync proposal for this spec is waiting: a button beside Sync reopens it. */
  syncWaiting?: boolean;
  onSyncWaiting?: () => void;
  /** The run column, e.g. a RunPanel; widens the modal when present. Gets a function that scrolls to the questions. */
  aside?: (goToQuestions: () => void) => ReactNode;
  /** Open another spec (`?spec=<id>`), from Dependencies. */
  onOpenSpec?: (id: string) => void;
  /** Keys changed by the last live update (`${id}:${n}` subtask rows flash). */
  changed?: ReadonlySet<string>;
  /** `${specId}:${qid}` for questions first seen through a live update (the New badge). */
  newQuestions?: ReadonlySet<string>;
  /** The New keys cleared by a successful answers save. */
  onQuestionsSeen?: (keys: string[]) => void;
  /** Where focus goes on close if the opening element is gone. */
  returnFocus?: () => HTMLElement | null;
}

const HIGHLIGHT_MS = 1600;
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** The card detail modal, opened from `?spec=<id>`. */
export function CardDetail(props: CardDetailProps) {
  const spec = props.specs.find((x) => x.id === props.specId) ?? props.archived.find((x) => x.id === props.specId);
  if (!spec) {
    // Review Focus 4: the open spec was deleted or archived away.
    const close = props.onClose;
    return (
      <Modal label="Spec not found" width="min(460px, 100%)" height="auto" onClose={close} {...(props.returnFocus ? { returnFocus: props.returnFocus } : {})}>
        <div className={s.missing}>
          <span>This spec was removed or archived</span>
          <button type="button" className={s.missingBtn} onClick={close}>
            Close
          </button>
        </div>
      </Modal>
    );
  }
  return <SpecDetail {...props} spec={spec} />;
}

type Section = 'questions' | 'dependencies';

function SpecDetail({
  pid,
  spec,
  root,
  specs,
  archived,
  client = api,
  mutate,
  refresh,
  toast,
  onMove,
  onClose,
  down = false,
  runState = 'ready',
  runningId = null,
  runBlockedNote,
  runBusyNote,
  runActive = false,
  onRun = () => undefined,
  onStop = () => undefined,
  onFixFile = () => undefined,
  onSync,
  syncWaiting = false,
  onSyncWaiting,
  aside,
  onOpenSpec = () => undefined,
  changed,
  newQuestions,
  onQuestionsSeen,
  returnFocus,
}: CardDetailProps & { spec: Spec }) {
  const id = spec.id;
  const simple = useSimple();
  /** Simple mode's ⋯ menu with urgency, categories and dependencies. */
  const [detailsOpen, setDetailsOpen] = useState(false);
  useEscape(simple && detailsOpen, () => setDetailsOpen(false), ESC.menu);
  const path = relPath(root, spec.path);
  const all = [...specs, ...archived];

  // Optimistic urgency/categories while writes are in flight, so rapid clicks build on each other.
  const [local, setLocal] = useState<{ urgency?: Urgency; categories?: string[] }>({});
  const inFlight = useRef(0);
  const urgency = local.urgency ?? spec.urgency;
  const categories = local.categories ?? spec.categories;

  const [editText, setEditText] = useState<string | null>(null);
  /** Body and its hash when editing began: the server rejects a save if the body changed since (F2). */
  const editBase = useRef<{ md: string; bodyHash: string }>({ md: '', bodyHash: '' });
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const dirty = editText !== null && editText !== editBase.current.md;
  /** Typed but unsaved answers in Questions (F3c). */
  const [answersDirty, setAnswersDirty] = useState(false);
  // Ruling 17 and F3: Esc leaves the editor before the modal; every way out (Esc, scrim, ×, a
  // dependency link, browser Back/Forward, closing the tab) asks before unsaved work is dropped.
  const { requestClose, guard, dialog: discardDialog } = useDiscardGuard({
    editing: editText !== null,
    dirty,
    otherDirty: answersDirty,
    what: 'this spec',
    onLeave: () => setEditText(null),
    onClose,
    guardPop: true,
  });

  const [hl, setHl] = useState<Section | null>(null);
  const hlTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = { questions: useRef<HTMLElement | null>(null), dependencies: useRef<HTMLElement | null>(null) };
  useEffect(
    () => () => {
      if (hlTimer.current !== null) clearTimeout(hlTimer.current);
    },
    [],
  );

  const offline = () => toast('err', ...OFFLINE_TOAST);

  const writeMeta = async (patch: { urgency?: Urgency; categories?: string[] }, op: (hash: string) => Promise<SpecWrite>) => {
    if (down) return offline();
    setLocal((l) => ({ ...l, ...patch }));
    inFlight.current += 1;
    try {
      await mutate(id, spec.hash, op);
    } catch (e) {
      if (e instanceof ConflictError) toast('err', `Couldn’t update ${id}`, 'The file changed. Try again.');
      else toast('err', `Couldn’t update ${id}`, message(e));
    }
    await refresh();
    inFlight.current -= 1;
    if (inFlight.current === 0) setLocal({});
  };

  const setUrgency = (u: Urgency) => void writeMeta({ urgency: u }, (h) => client.setMeta(pid, id, h, 'urgency', u));
  const setCategories = (next: string[]) => void writeMeta({ categories: next }, (h) => client.setMeta(pid, id, h, 'categories', next));

  const startEdit = () => {
    editBase.current = { md: spec.bodyMd, bodyHash: spec.bodyHash };
    setEditText(spec.bodyMd);
  };

  const save = async () => {
    if (editText === null || saving) return;
    if (down) return offline();
    const text = editText;
    const { bodyHash } = editBase.current;
    setSaving(true);
    try {
      // Any file hash will do (chain or current): writes that left the body alone are kept, and the
      // server 409s if the body itself changed since editing began.
      await mutate(id, spec.hash, (h) => client.setBody(pid, id, h, bodyHash, text));
    } catch (e) {
      setSaving(false);
      if (e instanceof ConflictError) setConflict(true);
      else toast('err', `Couldn’t save ${id}`, message(e));
      return;
    }
    await refresh();
    setSaving(false);
    setEditText(null);
    toast('ok', 'Spec saved', path);
  };

  const reloadKeepCopy = async () => {
    if (editText === null) return;
    let copy: string;
    try {
      copy = (await client.specDraftCopy(pid, id, editText)).path;
    } catch (e) {
      toast('err', 'Couldn’t save your copy', message(e));
      return;
    }
    setConflict(false);
    setEditText(null);
    await refresh();
    toast('ok', 'Reloaded latest version', `Your text is saved as ${copy}`);
  };

  /**
   * Keep the text and re-fetch, but leave the edit base where editing started: if the body really
   * changed, the next Save conflicts again, so nothing the user hasn't seen is overwritten
   * (Ruling 18, option a). The exits are "Reload & keep my copy" and "Reload".
   */
  const keepEditing = () => {
    setConflict(false);
    void refresh();
  };

  const reload = () => {
    setConflict(false);
    setEditText(null);
    void refresh();
    toast('info', 'Reloaded latest version', 'Your unsaved changes were discarded.');
  };

  const scrollTo = (key: Section) => {
    const c = scrollRef.current;
    const el = sectionRefs[key].current;
    if (c && el && typeof c.scrollTo === 'function') c.scrollTo({ top: el.offsetTop - 16, behavior: 'smooth' });
    setHl(key);
    if (hlTimer.current !== null) clearTimeout(hlTimer.current);
    hlTimer.current = setTimeout(() => {
      hlTimer.current = null;
      setHl(null);
    }, HIGHLIGHT_MS);
  };

  // Blocked reasons (pinned behaviour 8).
  // In Simple mode the dependencies are in the ⋯ menu, so that reason opens it.
  const reasons: BlockReason[] = blockTexts(spec, all).map((r) => ({
    key: r.key,
    text: r.text,
    onClick: () => (simple && r.section === 'dependencies' ? setDetailsOpen(true) : scrollTo(r.section)),
  }));
  const dependencies = (
    <Dependencies
      spec={spec}
      all={all}
      onOpen={(to) => guard(() => onOpenSpec(to))}
      {...(simple ? { compact: true } : { sectionRef: sectionRefs.dependencies, highlight: hl === 'dependencies' })}
    />
  );

  const allCategories = [...new Set(all.flatMap((x) => x.categories))];
  const problem = spec.problems[0];

  const dates = datesLine(spec.created, spec.updated);
  return (
    <Modal
      label={spec.title}
      width={aside ? 'min(1240px, 100%)' : 'min(900px, 100%)'}
      onClose={requestClose}
      {...(returnFocus ? { returnFocus } : {})}
    >
      <div className={s.root}>
        <DetailHeader
          id={id}
          path={path}
          title={spec.title}
          status={spec.status}
          urgency={urgency}
          categories={categories}
          allCategories={allCategories}
          runState={runState}
          runningId={runningId}
          runBlockedNote={runBlockedNote}
          runBusyNote={runBusyNote}
          runHold={runHold(spec, all)}
          onRun={onRun}
          onStop={onStop}
          {...(onSync ? { onSync } : {})}
          syncWaiting={syncWaiting}
          {...(onSyncWaiting ? { onSyncWaiting } : {})}
          onStatus={(k) => void onMove(spec, k)}
          onUrgency={setUrgency}
          onAddCategory={(c) => setCategories([...categories, c])}
          onRemoveCategory={(c) => setCategories(categories.filter((x) => x !== c))}
          onClose={requestClose}
          simple={simple}
          detailsOpen={detailsOpen}
          onDetails={setDetailsOpen}
          dependencies={dependencies}
        />
        <div className={s.body} style={{ gridTemplateColumns: aside ? 'minmax(0,1fr) 380px' : 'minmax(0,1fr)' }}>
          <div className={s.main}>
            <div ref={scrollRef} className={s.scroll} data-detail-scroll="">
              {problem !== undefined && <FileProblem message={problem} path={path} onFix={onFixFile} />}
              <SpecSection
                md={spec.bodyMd}
                text={editText}
                saving={saving}
                onEdit={startEdit}
                onChange={setEditText}
                onCancel={() => setEditText(null)}
                onSave={() => void save()}
              />
              <Questions
                pid={pid}
                spec={spec}
                path={path}
                client={client}
                mutate={mutate}
                refresh={refresh}
                toast={toast}
                down={down}
                {...(newQuestions ? { newQuestions } : {})}
                {...(onQuestionsSeen ? { onSeen: onQuestionsSeen } : {})}
                onDirtyChange={setAnswersDirty}
                sectionRef={sectionRefs.questions}
                highlight={hl === 'questions'}
              />
              {!simple && dependencies}
              <Subtasks
                pid={pid}
                spec={spec}
                client={client}
                mutate={mutate}
                refresh={refresh}
                toast={toast}
                down={down}
                {...(changed ? { changed } : {})}
                runActive={runActive}
              />
              {dates !== null && <p className={s.dates}>{dates}</p>}
            </div>
            {reasons.length > 0 && <BlockedBanner reasons={reasons} />}
          </div>
          {aside?.(() => scrollTo('questions'))}
        </div>
      </div>
      {conflict && editText !== null && (
        <ConflictDialog path={path} onKeepEditing={keepEditing} onReloadKeepCopy={() => void reloadKeepCopy()} onReload={reload} />
      )}
      {discardDialog}
    </Modal>
  );
}
