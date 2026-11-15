import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Join class names; a later Tailwind class wins over an earlier one from the same group. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
