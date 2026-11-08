import type { Context } from 'hono';

/** Messages thrown by core for bad caller input; anything else is a server fault. */
const CORE_400 = [/^Invalid value for /, /^Invalid key /, /^Cannot edit /, /^Only done specs can be archived/, /^(Subtask|Question) .+ not found$/];

/** Raised for requests we reject on purpose; carries the HTTP status. */
export class HttpError extends Error {
  constructor(
    readonly status: 400 | 404 | 409,
    message: string,
  ) {
    super(message);
  }
}

export async function readJson(c: Context): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new HttpError(400, 'Invalid JSON body');
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new HttpError(400, 'Invalid JSON body');
  return body as Record<string, unknown>;
}

export function requireString(b: Record<string, unknown>, key: string, allowEmpty = true): string {
  const v = b[key];
  if (typeof v !== 'string' || (!allowEmpty && v === '')) throw new HttpError(400, `Missing or invalid "${key}"`);
  return v;
}

/** Allowlist error mapping shared by all route groups; unknown errors become 500. */
export function onError(err: Error, c: Context): Response {
  if (err instanceof HttpError) return c.json({ error: err.message }, err.status);
  if (/^Spec .+ not found$/.test(err.message)) return c.json({ error: err.message }, 404);
  if (CORE_400.some((re) => re.test(err.message))) return c.json({ error: err.message }, 400);
  console.error(err.stack ?? err);
  return c.json({ error: 'Internal error' }, 500);
}
