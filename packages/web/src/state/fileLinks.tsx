import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { api } from '../api/client';
import type { PushToast } from './toasts';
import s from './fileLinks.module.css';

export type FileLinksClient = Pick<typeof api, 'openFile'>;

/** The full path the board can work out for itself, for when the server can't be asked. */
export function fullPath(root: string, rel: string): string {
  if (/^(?:[A-Za-z]:[\\/]|[\\/])/.test(rel)) return rel;
  const sep = root.includes('\\') ? '\\' : '/';
  return `${root.replace(/[\\/]+$/, '')}${sep}${rel.replace(/[\\/]/g, sep)}`;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

const Open = createContext<((rel: string) => void) | null>(null);

export interface FileLinksProps {
  pid: string;
  root: string;
  toast: PushToast;
  client?: FileLinksClient;
  children: ReactNode;
}

/** What a click on a file path does: open it in VS Code, or copy the full path and say so. */
export function FileLinks({ pid, root, toast, client = api, children }: FileLinksProps) {
  const open = useCallback(
    (rel: string) => {
      void (async () => {
        const res = await client.openFile(pid, rel).catch(() => null);
        if (res?.opened) {
          toast('ok', 'Opened in VS Code', rel);
          return;
        }
        const full = res?.path ?? fullPath(root, rel);
        if (!(await copyText(full))) {
          toast('err', 'Couldn’t copy the file path', full);
          return;
        }
        if (res?.reason === 'missing') toast('warn', 'File not found. Path copied', full);
        else toast('info', 'File path copied', full);
      })();
    },
    [client, pid, root, toast],
  );
  return <Open.Provider value={open}>{children}</Open.Provider>;
}

export interface FileLinkProps {
  /** Project-relative. */
  path: string;
  className?: string | undefined;
  children?: ReactNode;
}

/** A file path you can click. Plain text outside `FileLinks`, as in stories that have no project. */
export function FileLink({ path, className, children }: FileLinkProps) {
  const open = useContext(Open);
  const text = children ?? path;
  const classes = useMemo(() => [s.link, className].filter(Boolean).join(' '), [className]);
  if (!open) {
    return (
      <span className={className} title={path}>
        {text}
      </span>
    );
  }
  return (
    <button type="button" className={classes} title={`${path}\nOpen in VS Code, or copy the full path if it isn’t installed`} onClick={() => open(path)}>
      {text}
    </button>
  );
}
