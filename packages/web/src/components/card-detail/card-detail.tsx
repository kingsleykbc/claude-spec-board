import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Spec, Status, Urgency } from '@specboard/core';
import { api, ConflictError, type RunKind, type SpecWrite } from '@/api/client';
import { OFFLINE_TOAST, type Mutate } from '@/state/actions';
import { useSimple } from '@/state/simpleMode';
import type { PushToast } from '@/state/toasts';
import type { ManualReason } from '@/state/runUi';
import type { StartHandler } from '@/components/ui/start-button/start-button';
import { blockTexts, canFixReview, canWriteUp, relPath, runHold } from '@/lib/vm';
import { cn } from '@/lib/utils';
import { ConflictDialog } from '@/components/conflict-dialog/conflict-dialog';
import { Modal } from '@/components/ui/modal/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog/confirm-dialog';
import { useDiscardGuard } from '@/lib/use-discard-guard';
import { BlockedBanner, type BlockReason } from './blocked-banner/blocked-banner';
import { Dependencies } from './dependencies/dependencies';
import { DetailHeader } from './detail-header/detail-header';
import { FileProblem } from './file-problem/file-problem';
import type { RunState } from './run-button/run-button';
import { Questions } from './questions/questions';
import { RefreshWarning } from './refresh-warning/refresh-warning';
import { SpecSection } from './spec-section/spec-section';
import { specImageDir } from '@/lib/image-src';
import { Subtasks } from './subtasks/subtasks';
import { Attachments } from './attachments/attachments';
import { ToReview } from './to-review/to-review';

/** The detail footer: 'Created <date> · Updated <date>', leaving out what the spec lacks; null when it has neither. */
export function datesLine(created: string | null, updated: string | null): string | null {
  const parts = [created && `Created ${created}`, updated && `Updated ${updated}`].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

export type DetailClient = Pick<typeof api, 'setMeta' | 'setBody' | 'specDraftCopy' | 'setAnswers' | 'setSubtask'> & Partial<Pick<typeof api, 'uploadImage' | 'deleteImage' | 'setReview' | 'setReviewFailed'>>;

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
  /** Why the board can't run Claude here (null when it can): Run with Claude explains instead of starting. */
  manual?: ManualReason | null;
  /** Claude's status and the project's approval have loaded. */
  statusKnown?: boolean;
  /** A run is working on this spec (the subtask "In progress" pill). */
  runActive?: boolean;
  /** The step Claude is working on from a chat (no background run): a marker with "Not running? Clear". */
  chat?: number | null;
  /** Run with Claude. Like every start here, it may return a promise of the start: the button says Starting… until it settles. */
  onRun?: StartHandler;
  /** Fix review issues on a card in Review with a failed check (a `fix-review` run); without it the card keeps Run. */
  onFixReview?: StartHandler;
  onStop?: () => void;
  /** "Have Claude write this up" on a draft. */
  onWriteUp?: StartHandler;
  /** Archive (or, for an archived spec, Unarchive) from the card's ⋯ menu; no menu item without them. */
  onArchive?: () => void;
  onUnarchive?: () => void;
  /** "Ask Claude to fix" on a file problem. */
  onFixFile?: StartHandler;
  /** The header's Sync (this spec against the code); no button without it. */
  onSync?: StartHandler;
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
  /** Runs are approved and Claude is installed and signed in: a flagged save starts the question refresh on its own. */
  canAutoRun?: boolean;
  /** Starts a background run quietly (a refusal shows no toast). */
  startRun?: (kind: RunKind, specId: string) => Promise<unknown>;
  /** A refresh-questions run for this spec is going: no stale warning. */
  refreshing?: boolean;
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
        <div className="flex flex-col items-start gap-3.5 p-7 text-[15px]">
          <span>This spec was removed or archived</span>
          <button
            type="button"
            className="h-[34px] cursor-pointer rounded-lg border border-line2 bg-card px-3.5 py-0 text-[13px] font-semibold text-fg"
            onClick={close}
          >
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
  manual = null,
  statusKnown = true,
  runActive = false,
  chat = null,
  onRun = () => undefined,
  onFixReview,
  onStop = () => undefined,
  onWriteUp,
  onArchive,
  onUnarchive,
  onFixFile = () => undefined,
  onSync,
  syncWaiting = false,
  onSyncWaiting,
  aside,
  onOpenSpec = () => undefined,
  changed,
  newQuestions,
  onQuestionsSeen,
  canAutoRun = false,
  startRun,
  refreshing = false,
  returnFocus,
}: CardDetailProps & { spec: Spec }) {
  const id = spec.id;
  const simple = useSimple();
  /** Simple mode's ⋯ popover with urgency, categories and dependencies (Esc for it is in DetailHeader). */
  const [detailsOpen, setDetailsOpen] = useState(false);
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

  const [clearAsk, setClearAsk] = useState(false);
  const clearChat = async () => {
    setClearAsk(false);
    if (down) return offline();
    try {
      await mutate(id, spec.hash, (h) => client.setMeta(pid, id, h, 'current_subtask', null));
    } catch (e) {
      if (e instanceof ConflictError) toast('err', `Couldn’t update ${id}`, 'The file changed. Try again.');
      else toast('err', `Couldn’t update ${id}`, message(e));
    }
    await refresh();
  };

  const startEdit = () => {
    editBase.current = { md: spec.bodyMd, bodyHash: spec.bodyHash };
    setEditText(spec.bodyMd);
  };

  const save = async () => {
    if (editText === null || saving) return;
    if (down) return offline();
    const text = editText;
    const { bodyHash } = editBase.current;
    // Nothing changed: nothing to write, no flag, no paid refresh. Just leave edit mode.
    if (text === editBase.current.md) {
      setEditText(null);
      return;
    }
    setSaving(true);
    let saved: Spec | undefined;
    try {
      // Any file hash will do (chain or current): writes that left the body alone are kept, and the
      // server 409s if the body itself changed since editing began.
      await mutate(id, spec.hash, async (h) => {
        const res = await client.setBody(pid, id, h, bodyHash, text);
        saved = res.spec;
        return res;
      });
    } catch (e) {
      setSaving(false);
      if (e instanceof ConflictError) setConflict(true);
      else toast('err', `Couldn’t save ${id}`, message(e));
      return;
    }
    // The server flagged the questions and subtasks for a refresh: start it now, once per save and before the
    // re-fetch, so the warning doesn't flash. A refusal (busy, not set up, logged out) is quiet; the flag stays and
    // the warning shows. Review and Done specs and drafts never run.
    if (saved?.needsRefresh && canAutoRun && startRun && (saved.status === 'todo' || saved.status === 'doing') && !saved.draft) {
      startRun('refresh-questions', id).catch(() => undefined);
    }
    await refresh();
    setSaving(false);
    setEditText(null);
    toast('ok', 'Spec saved', undefined, { path });
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
  /** A failed check in Review: the header's Run with Claude becomes Fix review issues. */
  const fix = onFixReview !== undefined && canFixReview(spec);
  // Review and Done specs are frozen: no refresh prompt there.
  const frozen = spec.status === 'review' || spec.status === 'done';
  const stale = spec.needsRefresh && !refreshing && !frozen;
  const warning = stale ? <RefreshWarning id={id} /> : undefined;
  const subtasksWarning = stale ? <RefreshWarning id={id} label="Subtasks may be out of date" /> : undefined;
  return (
    <Modal
      label={spec.title}
      width={aside ? 'min(1240px, 100%)' : 'min(900px, 100%)'}
      onClose={requestClose}
      {...(returnFocus ? { returnFocus } : {})}
    >
      <div className="flex min-h-0 flex-1 flex-col [@media(max-width:640px)]:min-w-0 [@media(max-width:640px)]:overflow-x-hidden">
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
          manual={manual}
          statusKnown={statusKnown}
          runHold={fix ? null : runHold(spec, all, chat)}
          fixReview={fix}
          onRun={fix ? onFixReview : onRun}
          onStop={onStop}
          {...(onSync ? { onSync } : {})}
          syncWaiting={syncWaiting}
          {...(onSyncWaiting ? { onSyncWaiting } : {})}
          onStatus={(k) => void onMove(spec, k)}
          onUrgency={setUrgency}
          onAddCategory={(c) => setCategories([...categories, c])}
          onRemoveCategory={(c) => setCategories(categories.filter((x) => x !== c))}
          onClose={requestClose}
          draft={spec.draft}
          archived={spec.archived}
          /* A draft in Review or Done keeps its Draft badge but has nothing to write up. */
          {...(onWriteUp && canWriteUp(spec) ? { onWriteUp } : {})}
          {...(onArchive ? { onArchive } : {})}
          {...(onUnarchive ? { onUnarchive } : {})}
          simple={simple}
          detailsOpen={detailsOpen}
          onDetails={setDetailsOpen}
          dependencies={dependencies}
        />
        {/* With a run column beside the spec; on phones it stacks under it instead. */}
        <div
          className={cn(
            'grid min-h-0 flex-1 [@media(max-width:640px)]:grid-cols-[minmax(0,1fr)] [@media(max-width:640px)]:overflow-y-auto',
            aside ? 'grid-cols-[minmax(0,1fr)_380px]' : 'grid-cols-[minmax(0,1fr)]',
          )}
        >
          <div className="flex min-h-0 flex-col">
            <div
              ref={scrollRef}
              className="relative flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-7 pt-5 pb-7 [@media(max-width:640px)]:p-4"
              data-detail-scroll=""
            >
              {problem !== undefined && <FileProblem message={problem} path={path} onFix={onFixFile} />}
              <SpecSection
                md={spec.bodyMd}
                pid={pid}
                baseDir={specImageDir(spec.dir)}
                text={editText}
                saving={saving}
                onEdit={startEdit}
                onChange={setEditText}
                onCancel={() => setEditText(null)}
                onSave={() => void save()}
                onUpload={(file) => (client.uploadImage ?? api.uploadImage)(pid, id, file).then((r) => r.path)}
                onUploadError={(m) => toast('err', 'Couldn’t add the image', m)}
              />
              <Attachments
                pid={pid}
                spec={spec}
                client={{ uploadImage: client.uploadImage ?? api.uploadImage, deleteImage: client.deleteImage ?? api.deleteImage }}
                refresh={refresh}
                toast={toast}
                down={down}
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
                readOnly={spec.status === 'review' || spec.status === 'done'}
                warning={warning}
                sectionRef={sectionRefs.questions}
                highlight={hl === 'questions'}
              />
              {!simple && dependencies}
              {chat !== null && (
                <p className="m-0 flex flex-wrap items-center gap-x-2 text-[13px] text-fg2">
                  Claude is working on step {chat} in a chat.
                  <button type="button" className="cursor-pointer border-0 bg-transparent p-0 text-[13px] text-accent-ink underline" onClick={() => setClearAsk(true)}>
                    Not running? Clear
                  </button>
                </p>
              )}
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
                chat={chat}
                warning={subtasksWarning}
              />
              <ToReview
                pid={pid}
                spec={spec}
                client={{ setReview: client.setReview ?? api.setReview, setReviewFailed: client.setReviewFailed ?? api.setReviewFailed }}
                mutate={mutate}
                refresh={refresh}
                toast={toast}
                down={down}
              />
              {dates !== null && <p className="m-0 text-[12px] text-fg3">{dates}</p>}
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
      {clearAsk && (
        <ConfirmDialog
          title="Clear the working step?"
          body={`This removes the “working on step ${chat}” marker from ${id}. Do it only if no chat is running. Nothing else changes.`}
          onDismiss={() => setClearAsk(false)}
          actions={[
            { label: 'Keep it', onClick: () => setClearAsk(false) },
            { label: 'Clear', kind: 'primary', onClick: () => void clearChat() },
          ]}
        />
      )}
    </Modal>
  );
}
