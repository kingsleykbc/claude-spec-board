import type { MetaValues, Project, Spec } from '@specboard/core';

// Typed fetch wrappers for the server API (packages/server/src/app.ts and routes/).
// Types come from core as type-only imports, so no Node code reaches the bundle.

export interface ProjectEntry {
  id: string;
  name: string;
  root: string;
}
export interface ProjectSummary extends ProjectEntry {
  progress: { done: number; total: number };
}
export interface ProjectData {
  entry: ProjectEntry;
  project: Project;
  nextId: string;
}
export interface SpecWrite {
  hash: string;
  spec: Spec;
}
export interface ReferenceDoc {
  name: string;
  path: string;
  md: string;
  hash: string;
  missing: boolean;
}
export type MetaKey = 'status' | 'urgency' | 'categories' | 'title' | 'draft';

// Run wire types, duplicated from packages/server/src/claude/ (runs.ts, classify.ts, events.ts, status.ts).
export type RunKind = 'run' | 'write-up' | 'fix-file' | 'refresh-overview';
export type RunStatus = 'running' | 'finished' | 'stopped' | 'needs' | 'permission' | 'error';
export type RunLineKind = 'start' | 'read' | 'edit' | 'cmd' | 'ok' | 'done' | 'stop' | 'warn' | 'err';
/** A run's output line as the server sends it: `seq` counts from 1 within a run. */
export interface RunLine {
  seq: number;
  k: RunLineKind;
  text: string;
  code?: string;
  time: string;
  /** The subtask number, only on the line saying that subtask got done. */
  subtask?: number;
}
export interface Denial {
  tool: string;
  input: unknown;
}
export interface EndInfo {
  status: RunStatus;
  title?: string;
  text?: string;
  fix?: string;
  denied?: Denial[];
  /** The `(you)` step Claude stopped at. Set only on a `needs` end that waits on a person, not on an answer. */
  waiting?: string;
}
export interface RunSnapshot {
  id: string;
  pid: string;
  kind: RunKind;
  specId: string | null;
  status: RunStatus;
  lines: RunLine[];
  end: EndInfo | null;
  startedAt: string;
  dismissed: boolean;
}
export type RunEvent =
  | { type: 'run-started'; run: RunSnapshot }
  | { type: 'run-line'; runId: string; line: RunLine }
  | { type: 'run-ended'; run: RunSnapshot };
export interface ClaudeStatus {
  installed: boolean;
  loggedIn: boolean;
  version: string | null;
  /** `claude` was found only inside a registered project, here, so it was not run. A terminal may still find it. */
  blockedBy?: string;
  /** `claude` was found outside but failed to start, with this folder left out of its PATH. That may or may not be why. */
  maybeBlockedBy?: string;
}
export interface RunState {
  run: RunSnapshot | null;
  claude: ClaudeStatus;
  approved: boolean;
}

/** Any 4xx/5xx other than a 409 conflict. `body` is the parsed JSON error body when there was one (run starts carry `run`, `setup`, `claude`). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** 409: the file changed on disk since `hash` was read. */
export class ConflictError extends Error {
  readonly status = 409;
  constructor(
    readonly currentHash: string,
    readonly currentText: string,
  ) {
    super('The file changed outside the board');
    this.name = 'ConflictError';
  }
}

const enc = encodeURIComponent;
const proj = (pid: string) => `/api/projects/${enc(pid)}`;
const spec = (pid: string, id: string) => `${proj(pid)}/specs/${enc(id)}`;

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method, headers: { accept: 'application/json' } };
  // The server requires JSON on every mutating call (CSRF defence), so body-less ones send `{}`.
  if (method !== 'GET') {
    init.headers = { ...init.headers, 'content-type': 'application/json' };
    init.body = JSON.stringify(body ?? {});
  }
  const res = await fetch(url, init);
  const text = await res.text();
  let data: unknown = undefined;
  if (text !== '') {
    try {
      data = JSON.parse(text);
    } catch {
      data = undefined;
    }
  }
  if (res.status === 409) {
    const d = (data ?? {}) as { conflict?: boolean; currentHash?: string; currentText?: string; error?: string };
    if (d.conflict) throw new ConflictError(d.currentHash ?? '', d.currentText ?? '');
    throw new ApiError(409, d.error ?? 'Conflict', data);
  }
  if (!res.ok) {
    const msg = (data as { error?: string } | undefined)?.error ?? (res.statusText || `HTTP ${res.status}`);
    throw new ApiError(res.status, msg, data);
  }
  return data as T;
}

export const api = {
  // Reads
  health: () => request<{ ok: boolean; app: string }>('GET', '/api/health'),
  projects: () => request<ProjectSummary[]>('GET', '/api/projects'),
  project: (pid: string) => request<ProjectData>('GET', proj(pid)),

  // Spec writes (hash-checked; a 409 rejects with ConflictError)
  setMeta: <K extends MetaKey>(pid: string, id: string, hash: string, key: K, value: MetaValues[K]) =>
    request<SpecWrite>('PATCH', `${spec(pid, id)}/meta`, { hash, key, value }),
  setSubtask: (pid: string, id: string, n: number, hash: string, done: boolean) =>
    request<SpecWrite>('PATCH', `${spec(pid, id)}/subtasks/${n}`, { hash, done }),
  setAnswers: (pid: string, id: string, hash: string, answers: Record<string, string>) =>
    request<SpecWrite>('PATCH', `${spec(pid, id)}/answers`, { hash, answers }),
  /** `bodyHash` is `spec.bodyHash` from when editing began: the server 409s if the body changed since. */
  setBody: (pid: string, id: string, hash: string, bodyHash: string, md: string) =>
    request<SpecWrite>('PATCH', `${spec(pid, id)}/body`, { hash, bodyHash, md }),
  specDraftCopy: (pid: string, id: string, md: string) => request<{ path: string }>('POST', `${spec(pid, id)}/draft-copy`, { md }),
  createSpec: (pid: string, body: { title: string; description: string; draft: boolean }) =>
    request<{ spec: Spec }>('POST', `${proj(pid)}/specs`, body),
  /** `opened: false` gives the full path to copy instead. */
  openFile: (pid: string, path: string) =>
    request<{ opened: boolean; path: string; reason?: 'missing' | 'no-editor' }>('POST', `${proj(pid)}/open-file`, { path }),
  archive: (pid: string, id: string) => request<void>('POST', `${spec(pid, id)}/archive`),
  unarchive: (pid: string, id: string) => request<void>('POST', `${spec(pid, id)}/unarchive`),

  // References
  references: (pid: string) => request<ReferenceDoc[]>('GET', `${proj(pid)}/references`),
  saveReference: (pid: string, path: string, hash: string, md: string) =>
    request<{ hash: string }>('PUT', `${proj(pid)}/references/content`, { path, hash, md }),
  linkReference: (pid: string, path: string) => request<{ path: string }>('POST', `${proj(pid)}/references/link`, { path }),
  createReference: (pid: string, name: string) => request<{ path: string }>('POST', `${proj(pid)}/references/create`, { name }),
  removeReference: (pid: string, path: string) => request<void>('DELETE', `${proj(pid)}/references?path=${enc(path)}`),
  referenceDraftCopy: (pid: string, path: string, md: string) =>
    request<{ path: string }>('POST', `${proj(pid)}/references/draft-copy`, { path, md }),

  // Files
  files: (pid: string, q = '') => request<string[]>('GET', `${proj(pid)}/files?q=${enc(q)}`),

  // Runs
  getRun: (pid: string) => request<RunState>('GET', `${proj(pid)}/run`),
  startRun: (pid: string, kind: RunKind, specId?: string) =>
    request<{ run: RunSnapshot }>('POST', `${proj(pid)}/runs`, specId === undefined ? { kind } : { kind, specId }),
  stopRun: (pid: string, runId: string) => request<{ run: RunSnapshot | null }>('POST', `${proj(pid)}/runs/${enc(runId)}/stop`),
  dismissRun: (pid: string, runId: string) => request<void>('POST', `${proj(pid)}/runs/${enc(runId)}/dismiss`),
};
