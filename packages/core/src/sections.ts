export interface SectionRange {
  /** 0-based index of the `## ` heading line. */
  headingLine: number;
  /** First body line (inclusive). */
  start: number;
  /** End of the body (exclusive): the next `## ` heading, or the end of the file. */
  end: number;
}

const HEADING = /^##[ \t]+(.+?)[ \t]*#*[ \t]*$/;
const FENCE = /^[ \t]*(```|~~~)/;

/**
 * Find `## ` sections. Keys are lowercase heading text; line numbers are 0-based indices into `lines`.
 * `fromLine` skips leading lines (e.g. front matter). Headings inside code fences are ignored;
 * if a heading repeats, the first one wins.
 */
export function findSections(lines: string[], fromLine = 0): Map<string, SectionRange> {
  const found: { key: string; headingLine: number }[] = [];
  let fence: string | null = null;
  for (let i = fromLine; i < lines.length; i++) {
    const line = lines[i]!;
    const f = FENCE.exec(line);
    if (f) {
      if (fence === null) fence = f[1]!;
      else if (fence === f[1]) fence = null;
      continue;
    }
    if (fence !== null) continue;
    const m = HEADING.exec(line);
    if (m) found.push({ key: m[1]!.trim().toLowerCase(), headingLine: i });
  }
  const result = new Map<string, SectionRange>();
  found.forEach((h, idx) => {
    if (result.has(h.key)) return;
    const end = idx + 1 < found.length ? found[idx + 1]!.headingLine : lines.length;
    result.set(h.key, { headingLine: h.headingLine, start: h.headingLine + 1, end });
  });
  return result;
}
