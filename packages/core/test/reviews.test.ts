import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { replaceSpecBody, setReviewDone, setReviewFailed, specBodyMd } from '../src/edit.js';
import { parseSpec } from '../src/parseSpec.js';
import { loadProject } from '../src/project.js';
import { IMAGE_EXTS } from '../src/images.js';

const HEAD = '---\nid: T-9\ntitle: X\nstatus: review\n---\n\n## Spec\n\nBody text.\n\n## Open questions\n\n## Subtasks\n\n- [x] 1. Do it\n- [ ] 2. Check it (you)\n';
const REVIEW = [
  '',
  '## To review',
  '### Adding tasks',
  '- [ ] Add a task with the Enter key',
  '  > expected: It appears at the bottom of the list and the box clears.',
  '- [x] Reload the page',
  '  > expected: The task is still there.',
  '### Other',
  '- [ ] Plain item',
  '',
].join('\n');
const text = HEAD + REVIEW;

describe('parse To review', () => {
  it('parses items, expected lines, groups and ticks', () => {
    const d = parseSpec(text);
    expect(d.problems).toEqual([]);
    expect(d.reviews).toEqual([
      { n: 1, text: 'Add a task with the Enter key', expected: 'It appears at the bottom of the list and the box clears.', steps: [], failed: null, fixed: [], group: 'Adding tasks', done: false, line: 19 },
      { n: 2, text: 'Reload the page', expected: 'The task is still there.', steps: [], failed: null, fixed: [], group: 'Adding tasks', done: true, line: 21 },
      { n: 3, text: 'Plain item', expected: null, steps: [], failed: null, fixed: [], group: 'Other', done: false, line: 24 },
    ]);
    const lines = text.split('\n');
    for (const r of d.reviews) expect(lines[r.line]).toContain(r.text);
  });
  it('items before any group have group null; a missing section has no reviews', () => {
    expect(parseSpec(HEAD + '\n## To review\n- [ ] One\n').reviews[0]).toMatchObject({ group: null, expected: null });
    expect(parseSpec(HEAD).reviews).toEqual([]);
  });
  it('### headings do not end the section and old (you) subtasks stay separate', () => {
    const d = parseSpec(text);
    expect(d.reviews).toHaveLength(3);
    expect(d.subtasks.map((s) => s.title)).toEqual(['Do it', 'Check it (you)']);
    expect(d.specMd).toBe('Body text.');
  });
  it('flags an unrecognised list line and works with CRLF', () => {
    const d = parseSpec(HEAD + '\n## To review\n- not a checkbox\n- [ ] ok\n');
    expect(d.problems).toEqual([expect.stringMatching(/Unrecognised review line/)]);
    expect(d.reviews).toHaveLength(1);
    expect(parseSpec(text.replace(/\n/g, '\r\n')).reviews).toHaveLength(3);
    expect(parseSpec(text.replace(/\n/g, '\r\n')).reviews[0]!.expected).toBe('It appears at the bottom of the list and the box clears.');
  });
});

describe('specBodyMd and To review', () => {
  it('excludes To review but keeps other sections', () => {
    const t = text + '\n## Notes\n\nKeep me.\n';
    const md = specBodyMd(t);
    expect(md).not.toContain('To review');
    expect(md).not.toContain('Adding tasks');
    expect(md).toContain('Keep me.');
    expect(replaceSpecBody(t, md)).toBe(t);
  });
  it('replaceSpecBody leaves To review byte-for-byte and demotes a typed ## To review', () => {
    const out = replaceSpecBody(text, 'Changed.\n\n## To review\n\nbad');
    expect(out).toContain(REVIEW.trimEnd());
    expect(out).toContain('### To review');
    expect(parseSpec(out).reviews).toHaveLength(3);
  });
});

describe('setReviewDone', () => {
  it('ticks and unticks only that line and round-trips', () => {
    const out = setReviewDone(text, 1, true);
    const a = text.split('\n');
    const b = out.split('\n');
    expect(b.filter((l, i) => l !== a[i])).toEqual(['- [x] Add a task with the Enter key']);
    expect(setReviewDone(out, 1, false)).toBe(text);
    expect(parseSpec(setReviewDone(text, 3, true)).reviews[2]!.done).toBe(true);
  });
  it('keeps line endings, including mixed', () => {
    const crlf = text.replace(/\n/g, '\r\n');
    const out = setReviewDone(crlf, 2, false);
    expect(out.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
    expect(out).toContain('- [ ] Reload the page\r\n');
    expect(out.length).toBe(crlf.length);
  });
  it('an empty-text item is not an item: ticking item 3 ticks the third real line', () => {
    const t = HEAD + '\n## To review\n- [ ] One\n- [ ]\n- [ ] Two\n- [ ] Three\n';
    const d = parseSpec(t);
    expect(d.reviews.map((r) => r.text)).toEqual(['One', 'Two', 'Three']);
    expect(d.problems).toEqual([expect.stringMatching(/Unrecognised review line/)]);
    const out = setReviewDone(t, 3, true);
    expect(out).toContain('- [x] Three');
    expect(out).toContain('- [ ] Two');
    expect(out).toContain('- [ ]\n- [ ] Two');
  });
  it('throws on an unknown n and never touches subtasks', () => {
    expect(() => setReviewDone(text, 9, true)).toThrow('Review item 9 not found');
    expect(() => setReviewDone(HEAD, 1, true)).toThrow('Review item 1 not found');
    expect(() => setReviewDone(text, 0, true)).toThrow();
  });
});

const RICH = [
  '',
  '## To review',
  '- [ ] Add a task',
  '  > step: Run `npm run dev`',
  '  > expected: It shows at the bottom.',
  '  > step: Open [the app](http://localhost:5173) and click **Add**',
  '  > note: something a person wrote',
  '  > fixed: The button was red (a1b2c3d)',
  '  > failed: Nothing happens on Enter',
  '  > fixed: Second try (no commit)',
  '- [x] Reload the page',
  '  > expected: Still there.',
  '- [ ] Plain item',
  '',
].join('\n');
const rich = HEAD + RICH;

describe('To review steps, failed and fixed', () => {
  it('parses steps in order, the failed reason and the fixed history, in any order, and keeps line numbers right', () => {
    const d = parseSpec(rich);
    expect(d.problems).toEqual([]);
    expect(d.reviews).toEqual([
      {
        n: 1,
        text: 'Add a task',
        expected: 'It shows at the bottom.',
        steps: ['Run `npm run dev`', 'Open [the app](http://localhost:5173) and click **Add**'],
        failed: 'Nothing happens on Enter',
        fixed: ['The button was red (a1b2c3d)', 'Second try (no commit)'],
        group: null,
        done: false,
        line: 18,
      },
      { n: 2, text: 'Reload the page', expected: 'Still there.', steps: [], failed: null, fixed: [], group: null, done: true, line: 26 },
      { n: 3, text: 'Plain item', expected: null, steps: [], failed: null, fixed: [], group: null, done: false, line: 28 },
    ]);
    const lines = rich.split('\n');
    for (const r of d.reviews) expect(lines[r.line]).toContain(r.text);
  });

  it('an empty failed line is not a failure, empty steps are skipped, and CRLF works', () => {
    const t = HEAD + '\n## To review\n- [ ] One\n  > failed:\n  > step:\n  > step: Go\n';
    expect(parseSpec(t).reviews[0]).toMatchObject({ failed: null, steps: ['Go'] });
    expect(parseSpec(rich.replace(/\n/g, '\r\n')).reviews[0]!.failed).toBe('Nothing happens on Enter');
  });

  it('ticking with steps and other lines present changes only the item line, and round-trips', () => {
    const out = setReviewDone(rich, 3, true);
    const a = rich.split('\n');
    const b = out.split('\n');
    expect(b.filter((l, i) => l !== a[i])).toEqual(['- [x] Plain item']);
    expect(setReviewDone(out, 3, false)).toBe(rich);
    expect(setReviewDone(setReviewDone(rich, 2, false), 2, true)).toBe(rich);
  });

  it('ticking (Pass) removes the failed line and nothing else', () => {
    const out = setReviewDone(rich, 1, true);
    expect(out).toBe(rich.replace('- [ ] Add a task', '- [x] Add a task').replace('  > failed: Nothing happens on Enter\n', ''));
    expect(parseSpec(out).reviews[0]).toMatchObject({ done: true, failed: null, fixed: ['The button was red (a1b2c3d)', 'Second try (no commit)'] });
  });

  it('failing writes one failed line after the item lines, replaces an old one, and clears it', () => {
    const out = setReviewFailed(rich, 3, 'Wrong\ncolour\r\n  here ');
    expect(out).toBe(rich.replace('- [ ] Plain item\n', '- [ ] Plain item\n  > failed: Wrong colour here\n'));
    expect(parseSpec(out).reviews[2]).toMatchObject({ failed: 'Wrong colour here', done: false });
    expect(setReviewFailed(out, 3, null)).toBe(rich);
    const replaced = setReviewFailed(rich, 1, 'Still broken');
    expect(replaced).toBe(rich.replace('  > failed: Nothing happens on Enter', '  > failed: Still broken'));
    expect(setReviewFailed(rich, 1, null)).toBe(rich.replace('  > failed: Nothing happens on Enter\n', ''));
    expect(setReviewFailed(rich, 3, null)).toBe(rich);
  });

  it('failing an item with lines under it goes after them; at the end of the file it keeps the file ending', () => {
    const out = setReviewFailed(rich, 2, 'Gone');
    expect(out).toContain('- [ ] Reload the page\n  > expected: Still there.\n  > failed: Gone\n- [ ] Plain item');
    const noEol = HEAD + '\n## To review\n- [ ] Last';
    expect(setReviewFailed(noEol, 1, 'Bad')).toBe(noEol + '\n  > failed: Bad');
    expect(setReviewFailed(noEol + '\n  > failed: Bad', 1, null)).toBe(noEol);
    expect(setReviewDone(noEol + '\n  > failed: Bad', 1, true)).toBe(noEol.replace('- [ ] Last', '- [x] Last'));
    const crlf = rich.replace(/\n/g, '\r\n');
    const c = setReviewFailed(crlf, 3, 'Bad');
    expect(c).toBe(crlf.replace('- [ ] Plain item\r\n', '- [ ] Plain item\r\n  > failed: Bad\r\n'));
    expect(setReviewFailed(c, 3, null)).toBe(crlf);
  });

  it('failing a ticked item unticks it; an empty reason or unknown item throws', () => {
    expect(parseSpec(setReviewFailed(rich, 2, 'Nope')).reviews[1]).toMatchObject({ done: false, failed: 'Nope' });
    expect(() => setReviewFailed(rich, 1, ' \n ')).toThrow('The reason can’t be empty');
    expect(() => setReviewFailed(rich, 9, 'x')).toThrow('Review item 9 not found');
    expect(() => setReviewFailed(HEAD, 1, 'x')).toThrow('Review item 1 not found');
  });
});

describe('images and attachments', () => {
  const dirs: string[] = [];
  afterEach(async () => {
    for (const d of dirs.splice(0)) await fs.rm(d, { recursive: true, force: true });
  });
  async function project(specText: string, files: string[], kind = 'specs'): Promise<string> {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'specboard-img-'));
    dirs.push(root);
    const sb = path.join(root, '.specboard');
    await fs.mkdir(path.join(sb, kind, 'T-001-a', 'images'), { recursive: true });
    await fs.writeFile(path.join(sb, 'config.md'), '---\nname: "P"\n---\n');
    await fs.writeFile(path.join(sb, kind, 'T-001-a', 'spec.md'), specText);
    for (const f of files) await fs.writeFile(path.join(sb, kind, 'T-001-a', 'images', f), 'x');
    return root;
  }
  it('lists images sorted and attachments not linked in the text', async () => {
    const t = HEAD.replace('Body text.', 'See ![a](images/b.png) here.');
    const root = await project(t, ['z.JPG', 'b.png', 'a.webp', 'notes.txt']);
    const s = (await loadProject(root)).specs[0]!;
    expect(s.images).toEqual(['a.webp', 'b.png', 'z.JPG']);
    expect(s.attachments).toEqual(['a.webp', 'z.JPG']);
  });
  it('matches whole path tokens only', async () => {
    const t = HEAD.replace('Body text.', 'A ![x](./images/x.png) and ![s](images/a%20b.png) and images/a.png.bak and images/c.png.') + '\n## To review\n- [ ] Look at images/r.png\n';
    const root = await project(t, ['x.png', 'a b.png', 'a.png', 'c.png', 'r.png', 'd.png']);
    const s = (await loadProject(root)).specs[0]!;
    expect(s.attachments).toEqual(['a.png', 'd.png']);
  });
  it('has empty lists with no images folder, and works for archived specs', async () => {
    const root = await project(HEAD, [], 'archive');
    await fs.rm(path.join(root, '.specboard', 'archive', 'T-001-a', 'images'), { recursive: true });
    const p = await loadProject(root);
    expect(p.archived[0]).toMatchObject({ images: [], attachments: [] });
    const root2 = await project(HEAD, ['q.png'], 'archive');
    expect((await loadProject(root2)).archived[0]!.attachments).toEqual(['q.png']);
  });
  it('exports the shared extension list', () => {
    expect(IMAGE_EXTS).toEqual(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif']);
  });
});
