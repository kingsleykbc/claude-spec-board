import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LineSplitter, parseEvent, type ClaudeResult, type ParsedLine } from '../src/claude/events.js';

const dir = path.join(import.meta.dirname, 'fixtures', 'claude');
const fixture = (name: string) => fs.readFileSync(path.join(dir, `${name}.jsonl`), 'utf8').split('\n').filter(Boolean);
const run = (name: string) => {
  const lines: ParsedLine[] = [];
  let result: ClaudeResult | undefined;
  for (const l of fixture(name)) {
    const p = parseEvent(l, '<ROOT>');
    if (p) { lines.push(...p.lines); if (p.result) result = p.result; }
  }
  return { lines, result };
};
const tool = (name: string, input: unknown) => JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name, input }] } });

describe('LineSplitter', () => {
  it('joins a line split across chunks', () => {
    const s = new LineSplitter();
    expect(s.push(Buffer.from('{"a":1}\n{"b"'))).toEqual(['{"a":1}']);
    expect(s.push(Buffer.from(':2}\n'))).toEqual(['{"b":2}']);
    expect(s.flush()).toEqual([]);
  });

  it('keeps a multi-byte character split across chunks whole', () => {
    const s = new LineSplitter();
    const bytes = Buffer.from('{"t":"€"}\n');
    const cut = bytes.indexOf(0xe2) + 1;
    expect(s.push(bytes.subarray(0, cut))).toEqual([]);
    expect(s.push(bytes.subarray(cut))).toEqual(['{"t":"€"}']);
  });

  it('strips CRLF and flushes an unterminated last line', () => {
    const s = new LineSplitter();
    expect(s.push(Buffer.from('a\r\nb'))).toEqual(['a']);
    expect(s.flush()).toEqual(['b']);
  });
});

describe('parseEvent', () => {
  it('returns null for non-JSON, ignorable events and non-objects without throwing', () => {
    expect(parseEvent('not json')).toBeNull();
    expect(parseEvent('{"type":"hook_started"}')).toBeNull();
    expect(parseEvent('42')).toBeNull();
    expect(parseEvent('null')).toBeNull();
    expect(parseEvent('{"type":"system","subtype":"init"}')).toBeNull();
  });

  it('maps the tool calls of a real run, with paths relative to the root', () => {
    const { lines, result } = run('ok-tools');
    expect(lines).toEqual([
      { k: 'read', text: 'Read', code: 'notes.txt' },
      { k: 'edit', text: 'Editing', code: 'out.txt' },
      { k: 'cmd', text: 'Running', code: 'git status' },
    ]);
    expect(result).toEqual({ isError: false, resultText: 'done', terminalReason: 'completed', apiStatus: null, denials: [], sessionId: '<SESSION>' });
  });

  it('shows a path outside the root as is, and handles both slash styles', () => {
    expect(parseEvent(tool('Read', { file_path: 'C:\\proj\\src\\a.ts' }), 'C:\\proj')!.lines[0]!.code).toBe('src/a.ts');
    expect(parseEvent(tool('Read', { file_path: 'C:/proj/src/a.ts' }), 'C:\\proj\\')!.lines[0]!.code).toBe('src/a.ts');
    expect(parseEvent(tool('Read', { file_path: 'c:\\PROJ\\a.ts' }), 'C:\\proj')!.lines[0]!.code).toBe('a.ts');
    expect(parseEvent(tool('Read', { file_path: 'C:\\projector\\a.ts' }), 'C:\\proj')!.lines[0]!.code).toBe('C:/projector/a.ts');
    expect(parseEvent(tool('Read', { file_path: 'C:\\other\\a.ts' }), 'C:\\proj')!.lines[0]!.code).toBe('C:/other/a.ts');
  });

  it('maps Glob and Grep to read lines with the pattern', () => {
    expect(parseEvent(tool('Glob', { pattern: 'src/**/*.ts' }))!.lines).toEqual([{ k: 'read', text: 'Read', code: 'src/**/*.ts' }]);
    expect(parseEvent(tool('Grep', { pattern: 'foo' }))!.lines).toEqual([{ k: 'read', text: 'Read', code: 'foo' }]);
  });

  it('says "Running tests" for test commands and not for others', () => {
    const l = (command: string) => parseEvent(tool('Bash', { command }))!.lines[0]!;
    expect(l('npm test -- planner')).toEqual({ k: 'cmd', text: 'Running tests', code: 'npm test -- planner' });
    expect(l('npx vitest run').text).toBe('Running tests');
    expect(l('npm run migrate').text).toBe('Running');
    expect(l('git status').text).toBe('Running');
  });

  it('maps a PowerShell call to a command line', () => {
    const { lines } = run('powershell-denied');
    expect(lines[0]).toMatchObject({ k: 'cmd', text: 'Running' });
    expect(lines[0]!.code).toMatch(/^git commit --allow-empty/);
  });

  it('maps an errored tool_result to an err line, and a successful one to nothing', () => {
    const err = run('denied').lines.filter((l) => l.k === 'err');
    expect(err).toHaveLength(1);
    expect(err[0]!.text).toMatch(/^Permission to use Bash has been denied/);
    expect(run('ok-tools').lines.some((l) => l.k === 'err')).toBe(false);
    const deny = run('claude-dir-deny').lines.filter((l) => l.k === 'err');
    expect(deny.map((l) => l.text)).toEqual([
      'File is in a directory that is denied by your permission settings.',
      'File is in a directory that is denied by your permission settings.',
    ]);
  });

  it('reads denials from permission_denials, not from system events', () => {
    expect(run('denied').result!.denials).toEqual([{ tool: 'Bash', input: { command: 'npm --version', description: 'Print npm version' } }]);
    const r = run('claude-dir-deny').result!;
    expect(r.isError).toBe(false);
    expect(r.denials.map((d) => d.tool)).toEqual(['Write', 'Edit']);
    expect(parseEvent(fixture('denied').find((l) => l.includes('"permission_denied"'))!)).toBeNull();
  });

  it('flags failures through isError, not subtype', () => {
    const bad = run('bad-model').result!;
    expect(bad).toMatchObject({ isError: true, terminalReason: 'api_error', apiStatus: 404 });
    expect(bad.resultText).toMatch(/nosuchmodel/);
    const turns = run('error-max-turns').result!;
    expect(turns).toMatchObject({ isError: true, terminalReason: 'max_turns', apiStatus: null });
    expect(turns.resultText).toBe('Reached maximum number of turns (1)');
  });

  it('parses every line of every fixture without throwing', () => {
    for (const f of fs.readdirSync(dir)) {
      for (const l of fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter(Boolean)) {
        expect(() => parseEvent(l, '<ROOT>')).not.toThrow();
      }
    }
  });
});
