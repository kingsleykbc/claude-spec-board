import { Dialog } from './Dialog';

export interface ConflictDialogProps {
  /** Project-relative path of the file that changed. */
  path: string;
  onKeepEditing: () => void;
  onReloadKeepCopy: () => void;
  onReload: () => void;
}

/** A save got a 409 (pinned behaviour 11; prototype lines 768-772). Esc and the scrim keep editing. */
export function ConflictDialog({ path, onKeepEditing, onReloadKeepCopy, onReload }: ConflictDialogProps) {
  return (
    <Dialog
      title="This spec changed outside the board"
      body="Claude updated the file while you were editing. Reload to see the latest version? You can keep your unsaved text as a separate copy."
      path={path}
      onDismiss={onKeepEditing}
      actions={[
        { label: 'Keep editing', onClick: onKeepEditing },
        { label: 'Reload & keep my copy', onClick: onReloadKeepCopy },
        { label: 'Reload', onClick: onReload, kind: 'primary' },
      ]}
    />
  );
}
