import { useState, type ReactNode } from 'react';
import { ESC, useEscape } from '@/lib/escape';
import { useBeforeUnload, usePopGuard } from '@/lib/popGuard';
import { ConfirmDialog } from '@/components/ui/confirm-dialog/confirm-dialog';

export interface DiscardGuardOptions {
  /** An editor is open. */
  editing: boolean;
  /** Its text differs from what editing started with. */
  dirty: boolean;
  /**
   * Other unsaved work that only leaving the modal loses (typed answers, a new spec's fields). Esc
   * inside the editor ignores it; every way of leaving the modal asks first, and Discard then leaves.
   */
  otherDirty?: boolean;
  /** "this spec", "this document": what the dialog says was edited. */
  what: string;
  /** Close the editor (dropping its text). */
  onLeave: () => void;
  /** Close the whole modal. */
  onClose: () => void;
  /** Also ask before browser Back/Forward (popstate) leaves (F3b). */
  guardPop?: boolean;
}

export interface DiscardGuard {
  /** For the modal's Esc, scrim and ×: asks first when there are unsaved changes, else closes. */
  requestClose: () => void;
  /** Run `then` after leaving the editor, asking first when there are unsaved changes. */
  guard: (then: () => void) => void;
  /** The "Discard your changes?" dialog, or null. */
  dialog: ReactNode;
}

/**
 * Ruling 17 and F3: unsaved text is never dropped silently. Esc leaves the editor (above the modal
 * in the Esc stack), and the scrim, × and other exits ask "Discard your changes?" first when
 * something changed. With only editor changes, Discard closes just the editor; a later Esc or
 * scrim press closes the modal. While anything is unsaved, a tab close or reload asks too.
 */
export function useDiscardGuard({ editing, dirty, otherDirty = false, what, onLeave, onClose, guardPop = false }: DiscardGuardOptions): DiscardGuard {
  /** Open dialog, with what to do after Discard. */
  const [ask, setAsk] = useState<{ then?: () => void } | null>(null);
  const anyDirty = dirty || otherDirty;

  useEscape(editing, () => (dirty ? setAsk({}) : onLeave()), ESC.editor);

  // Other unsaved work cannot be dropped while staying, so Discard there closes the modal.
  const requestClose = () => (otherDirty ? setAsk({ then: onClose }) : dirty ? setAsk({}) : onClose());
  const guard = (then: () => void) => {
    if (anyDirty) setAsk({ then });
    else then();
  };

  usePopGuard(guardPop && anyDirty, guard);
  useBeforeUnload(anyDirty);

  const dialog =
    ask && (editing || otherDirty) ? (
      <ConfirmDialog
        title="Discard your changes?"
        body={`Your edits to ${what} haven’t been saved. Discarding closes the editor and keeps the file as it is.`}
        onDismiss={() => setAsk(null)}
        actions={[
          { label: 'Keep editing', onClick: () => setAsk(null) },
          {
            label: 'Discard',
            kind: 'danger',
            onClick: () => {
              setAsk(null);
              onLeave();
              ask.then?.();
            },
          },
        ]}
      />
    ) : null;

  return { requestClose, guard, dialog };
}
