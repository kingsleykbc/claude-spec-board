import { useState, type ReactNode } from 'react';
import { ESC, useEscape } from '../lib/escape';
import { Dialog } from './Dialog';

export interface DiscardGuardOptions {
  /** An editor is open. */
  editing: boolean;
  /** Its text differs from what editing started with. */
  dirty: boolean;
  /** "this spec", "this document": what the dialog says was edited. */
  what: string;
  /** Close the editor (dropping its text). */
  onLeave: () => void;
  /** Close the whole modal. */
  onClose: () => void;
}

export interface DiscardGuard {
  /** For the modal's scrim and ×: asks first when there are unsaved changes, else closes. */
  requestClose: () => void;
  /** Run `then` after leaving the editor, asking first when there are unsaved changes. */
  guard: (then: () => void) => void;
  /** The "Discard your changes?" dialog, or null. */
  dialog: ReactNode;
}

/**
 * Ruling 17: unsaved editor text is never dropped silently. Esc leaves the editor (above the modal
 * in the Esc stack), and the scrim and × ask "Discard your changes?" first when the text changed.
 * Discard closes only the editor; a later Esc or scrim press closes the modal.
 */
export function useDiscardGuard({ editing, dirty, what, onLeave, onClose }: DiscardGuardOptions): DiscardGuard {
  /** Open dialog, with what to do after Discard. */
  const [ask, setAsk] = useState<{ then?: () => void } | null>(null);

  useEscape(editing, () => (dirty ? setAsk({}) : onLeave()), ESC.editor);

  const requestClose = () => (dirty ? setAsk({}) : onClose());
  const guard = (then: () => void) => {
    if (dirty) setAsk({ then });
    else then();
  };

  const dialog =
    ask && editing ? (
      <Dialog
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
