import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../api/client';
import type { PushToast } from './toasts';
import { Hint } from '@/components/ui/hint/hint';
import { cn } from '@/lib/utils';

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

type OpenFile = (rel: string) => void;
const Open = createContext<OpenFile | null>(null);
const Register = createContext<((open: OpenFile | null) => void) | null>(null);

/**
 * Sits above everything that renders paths, the toast stack included, and hands them whichever
 * `FileLinks` is mounted below (the open project's). Paths are plain text until one mounts.
 */
export function FileLinksHost({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<OpenFile | null>(null);
  const register = useCallback((o: OpenFile | null) => setOpen(() => o), []);
  return (
    <Register.Provider value={register}>
      <Open.Provider value={open}>{children}</Open.Provider>
    </Register.Provider>
  );
}

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
  const register = useContext(Register);
  useEffect(() => {
    register?.(open);
    return () => register?.(null);
  }, [register, open]);
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
  if (!open) {
    return (
      <span className={className} title={path}>
        {text}
      </span>
    );
  }
  // A plain-looking link: the caller's classes (font, box, colour) win over these.
  return (
    <Hint label={`${path} · Open in VS Code, or copy the full path if it isn’t installed`}>
      <button
        type="button"
        className={cn('cursor-pointer border-0 bg-transparent p-0 text-left text-inherit hover:text-accent-ink hover:underline', className)}
        // A plain path keeps its own text as its name (Hint would otherwise name it with the tooltip).
        {...(typeof text === 'string' ? { 'aria-label': text } : {})}
        onClick={() => open(path)}
      >
        {text}
      </button>
    </Hint>
  );
}
