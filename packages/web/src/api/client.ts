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
export type ClaudeAction = 'run' | 'stop' | 'write-up' | 'fix-file' | 'refresh-overview';
export type MetaKey = 'status' | 'urgency' | 'categories' | 'title' | 'draft';

/** Any 4xx/5xx other than a 409 conflict. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
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
    throw new ApiError(409, d.error ?? 'Conflict');
  }
  if (!res.ok) {
    const msg = (data as { error?: string } | undefined)?.error ?? (res.statusText || `HTTP ${res.status}`);
    throw new ApiError(res.status, msg);
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
  setBody: (pid: string, id: string, hash: string, md: string) => request<SpecWrite>('PATCH', `${spec(pid, id)}/body`, { hash, md }),
  specDraftCopy: (pid: string, id: string, md: string) => request<{ path: string }>('POST', `${spec(pid, id)}/draft-copy`, { md }),
  createSpec: (pid: string, body: { title: string; description: string; draft: boolean }) =>
    request<{ spec: Spec }>('POST', `${proj(pid)}/specs`, body),
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

  /** Claude actions are stubs in M2: the server answers 501, which resolves as `{ stub: true }`. */
  claude: async (action: ClaudeAction, body: Record<string, unknown> = {}): Promise<{ stub: boolean }> => {
    try {
      await request<unknown>('POST', `/api/claude/${enc(action)}`, body);
      return { stub: false };
    } catch (e) {
      if (e instanceof ApiError && e.status === 501) return { stub: true };
      throw e;
    }
  },
};
