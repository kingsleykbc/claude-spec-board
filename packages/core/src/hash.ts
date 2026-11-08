import { createHash } from 'node:crypto';

/** sha256 hex of the exact text. */
export function hashText(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}
