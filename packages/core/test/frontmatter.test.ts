import { describe, expect, it } from 'vitest';
import { parseSpecMeta, splitFrontMatter } from '../src/frontmatter.js';

describe('parseSpecMeta', () => {
  it('parses all keys', () => {
    const yaml = [
      'id: T-001',
      'title: Add login',
      'status: doing',
      'urgency: high',
      'categories: [auth, ui]',
      'depends_on: [T-000]',
      'draft: true',
      'current_subtask: 2',
      'created: 2026-01-02',
      'updated: 2026-01-03',
    ].join('\n');
    const { meta, problems } = parseSpecMeta(yaml);
    expect(problems).toEqual([]);
    expect(meta).toEqual({
      id: 'T-001',
      title: 'Add login',
      status: 'doing',
      urgency: 'high',
      categories: ['auth', 'ui'],
      dependsOn: ['T-000'],
      draft: true,
      milestone: null,
      currentSubtask: 2,
      created: '2026-01-02',
      updated: '2026-01-03',
    });
  });

  it('applies defaults', () => {
    const { meta, problems } = parseSpecMeta('id: T-002\ntitle: Minimal');
    expect(problems).toEqual([]);
    expect(meta.status).toBe('todo');
    expect(meta.urgency).toBe('normal');
    expect(meta.categories).toEqual([]);
    expect(meta.dependsOn).toEqual([]);
    expect(meta.draft).toBe(false);
    expect(meta.currentSubtask).toBeNull();
    expect(meta.created).toBeNull();
    expect(meta.updated).toBeNull();
  });

  it('reports an unknown status and falls back to todo', () => {
    const { meta, problems } = parseSpecMeta('id: T-003\ntitle: X\nstatus: wip');
    expect(meta.status).toBe('todo');
    expect(problems).toContain('Unknown status "wip"');
  });

  it('does not throw on broken yaml', () => {
    const { meta, problems } = parseSpecMeta('title: [unclosed');
    expect(problems.length).toBe(1);
    expect(meta.id).toBe('');
    expect(meta.title).toBe('');
  });

  it('handles null yaml', () => {
    const { meta, problems } = parseSpecMeta(null);
    expect(meta.id).toBe('');
    expect(problems.length).toBe(1);
  });
});

describe('splitFrontMatter', () => {
  it('returns null yaml when there is no front matter', () => {
    expect(splitFrontMatter('# Hi')).toEqual({ yaml: null, body: '# Hi', bodyStartLine: 0, closingLine: null });
  });

  it('splits LF front matter', () => {
    expect(splitFrontMatter('---\nid: T-001\n---\nbody')).toEqual({
      yaml: 'id: T-001',
      body: 'body',
      bodyStartLine: 3,
      closingLine: 2,
    });
  });

  it('splits CRLF front matter', () => {
    const r = splitFrontMatter('---\r\nid: T-001\r\n---\r\nbody');
    expect(r.yaml).toBe('id: T-001');
    expect(r.body).toBe('body');
    expect(r.bodyStartLine).toBe(3);
  });
});

describe('splitFrontMatter edge cases', () => {
  it('F3: reports the closing line, also without a final newline', () => {
    expect(splitFrontMatter('---\nid: T-1\n---')).toEqual({ yaml: 'id: T-1', body: '', bodyStartLine: 3, closingLine: 2 });
    expect(splitFrontMatter('---\n---\n')).toMatchObject({ yaml: '', bodyStartLine: 2, closingLine: 1 });
  });
  it('F2: accepts a leading BOM', () => {
    expect(splitFrontMatter('\uFEFF---\nid: T-1\n---\nbody')).toEqual({ yaml: 'id: T-1', body: 'body', bodyStartLine: 3, closingLine: 2 });
  });
});
