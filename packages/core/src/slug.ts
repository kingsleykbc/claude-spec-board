/** Lowercase ASCII `[a-z0-9-]` slug, at most 40 chars; falls back to 'spec'. */
export function slugify(title: string): string {
  const s = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return s === '' ? 'spec' : s;
}
