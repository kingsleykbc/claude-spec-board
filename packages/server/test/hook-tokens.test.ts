import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runTokenHook } from '../src/hookTokens.js';

let tmp: string;
let logFile: string;
let transcript: string;
let dataDir: string;

const line = (id: string, u: [number, number, number, number]) =>
  JSON.stringify({
    type: 'assistant',
    requestId: 'req_' + id,
    message: { id, usage: { input_tokens: u[0], cache_creation_input_tokens: u[1], cache_read_input_tokens: u[2], output_tokens: u[3] } },
  });

const input = (over: Partial<Parameters<typeof runTokenHook>[0]> = {}) => ({
  transcript_path: transcript,
  session_id: 's1',
  tool_input: { file_path: logFile },
  ...over,
});

beforeEach(async () => {
  tmp = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'sb-tok-')));
  const logs = path.join(tmp, '.specboard', 'specs', 'A-1-x', 'logs');
  await fs.mkdir(logs, { recursive: true });
  logFile = path.join(logs, '2-thing.md');
  await fs.writeFile(logFile, '---\nsubtask: 2\ncommit: abc\n---\n\n### 2026-11-08 14:32\nDid it.\n');
  transcript = path.join(tmp, 't.jsonl');
  dataDir = path.join(tmp, 'data');
  await fs.writeFile(transcript, [line('m1', [2, 20, 30, 8]), 'not json', JSON.stringify({ type: 'user' })].join('\n') + '\n');
});
afterEach(() => fs.rm(tmp, { recursive: true, force: true }));

describe('runTokenHook', () => {
  it('ignores a path that is not a subtask log', async () => {
    const other = path.join(tmp, 'a.md');
    await fs.writeFile(other, 'x');
    expect(await runTokenHook(input({ tool_input: { file_path: other } }), { dataDir })).toBeNull();
    expect(await fs.readFile(logFile, 'utf8')).not.toContain('tokens');
  });

  it('gives the first write the session total, inserted as the last front matter line', async () => {
    expect(await runTokenHook(input(), { dataDir })).toEqual({ wrote: 60 });
    expect(await fs.readFile(logFile, 'utf8')).toBe('---\nsubtask: 2\ncommit: abc\ntokens: 60\n---\n\n### 2026-11-08 14:32\nDid it.\n');
    expect(JSON.parse(await fs.readFile(path.join(dataDir, 'tokens', 's1.json'), 'utf8'))).toEqual({ total: 60 });
  });

  it('gives the second write only the delta', async () => {
    await runTokenHook(input(), { dataDir });
    await fs.appendFile(transcript, line('m2', [1, 0, 0, 9]) + '\n');
    expect(await runTokenHook(input(), { dataDir })).toEqual({ wrote: 10 });
    expect(await fs.readFile(logFile, 'utf8')).toContain('tokens: 70\n');
  });

  it('counts a repeated message id once', async () => {
    await fs.appendFile(transcript, line('m1', [2, 20, 30, 8]) + '\n');
    expect(await runTokenHook(input(), { dataDir })).toEqual({ wrote: 60 });
  });

  it('adds the delta to an existing tokens line', async () => {
    await fs.writeFile(logFile, '---\nsubtask: 2\ntokens: 100\n---\nbody\n');
    await runTokenHook(input(), { dataDir });
    expect(await fs.readFile(logFile, 'utf8')).toBe('---\nsubtask: 2\ntokens: 160\n---\nbody\n');
  });

  it('keeps CRLF line endings', async () => {
    await fs.writeFile(logFile, '---\r\nsubtask: 2\r\n---\r\nbody\r\n');
    await runTokenHook(input(), { dataDir });
    expect(await fs.readFile(logFile, 'utf8')).toBe('---\r\nsubtask: 2\r\ntokens: 60\r\n---\r\nbody\r\n');
  });

  it('only saves the checkpoint when nothing is new', async () => {
    await runTokenHook(input(), { dataDir });
    const before = await fs.readFile(logFile, 'utf8');
    expect(await runTokenHook(input(), { dataDir })).toEqual({ wrote: 0 });
    expect(await fs.readFile(logFile, 'utf8')).toBe(before);
  });

  it('does not write when track_tokens is false', async () => {
    await fs.writeFile(path.join(tmp, '.specboard', 'settings.md'), '---\ntrack_tokens: false\n---\n');
    expect(await runTokenHook(input(), { dataDir })).toBeNull();
    expect(await fs.readFile(logFile, 'utf8')).not.toContain('tokens');
  });

  it('returns null for a missing transcript and for a log without front matter', async () => {
    expect(await runTokenHook(input({ transcript_path: path.join(tmp, 'none.jsonl') }), { dataDir })).toBeNull();
    await fs.writeFile(logFile, 'no front matter\n');
    expect(await runTokenHook(input(), { dataDir })).toBeNull();
    expect(await fs.readFile(logFile, 'utf8')).toBe('no front matter\n');
  });

  it.runIf(process.platform === 'win32')('matches a backslash path', async () => {
    const win = logFile.split(path.sep).join('\\');
    expect(await runTokenHook(input({ tool_input: { file_path: win } }), { dataDir })).toEqual({ wrote: 60 });
  });
});
