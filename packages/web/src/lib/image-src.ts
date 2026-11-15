export type ImageSrc = { kind: 'img'; url: string } | { kind: 'link'; url: string };

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** Joins and normalises like posix paths; null when the result leaves the root. */
function joinInside(baseDir: string, rel: string): string | null {
  const out: string[] = [];
  for (const part of `${baseDir}/${rel}`.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      if (out.length === 0) return null;
      out.pop();
    } else out.push(part);
  }
  return out.length > 0 ? out.join('/') : null;
}

/**
 * Where an image in Markdown should come from. Web images load as they are; a project-relative one goes through the
 * server's image route; anything else (no folder to resolve against, a path leaving the project, `data:`, `file:`)
 * stays a link, so nothing loads that shouldn't.
 */
export function imageSrc(pid: string, src: string, baseDir?: string): ImageSrc {
  const link: ImageSrc = { kind: 'link', url: src };
  if (/^https?:\/\//i.test(src)) return { kind: 'img', url: src };
  if (src === '' || baseDir === undefined || SCHEME.test(src) || src.startsWith('/') || src.startsWith('//')) return link;
  let decoded: string;
  try {
    decoded = decodeURIComponent(src);
  } catch {
    return link;
  }
  const joined = joinInside(baseDir, decoded);
  if (joined === null) return link;
  return { kind: 'img', url: `/api/projects/${pid}/image?path=${encodeURIComponent(joined)}` };
}

/**
 * A spec's folder, project-relative: from `.specboard/` on. The server sends absolute folders, and an archived spec's
 * lives under `.specboard/archive/`, so cutting at the last `.specboard/specs|archive/` covers both.
 */
export function specImageDir(dir: string): string | undefined {
  const norm = dir.split(String.fromCharCode(92)).join('/');
  const m = /(?:^|\/)(\.specboard\/(?:specs|archive)\/[^/]+)\/*$/.exec(norm);
  return m ? m[1] : undefined;
}

/** The folder of a project-relative file path; '' for one at the project root. */
export function dirOf(file: string): string {
  const norm = file.split(String.fromCharCode(92)).join('/');
  const i = norm.lastIndexOf('/');
  return i < 0 ? '' : norm.slice(0, i);
}
