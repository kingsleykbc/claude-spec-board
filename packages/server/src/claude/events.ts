import { StringDecoder } from 'node:string_decoder';

export type RunLineKind = 'start' | 'read' | 'edit' | 'cmd' | 'ok' | 'done' | 'stop' | 'warn' | 'err';
export interface RunLine {
  seq: number;
  k: RunLineKind;
  text: string;
  code?: string;
  time: string;
  /** The subtask number, only on the line saying that subtask got done. */
  subtask?: number;
}
export interface Denial { tool: string; input: unknown }
export interface ClaudeResult {
  isError: boolean;
  resultText: string;
  terminalReason: string | null;
  apiStatus: number | null;
  denials: Denial[];
  sessionId: string | null;
}
export type ParsedLine = Omit<RunLine, 'seq' | 'time'>;

/** Splits a byte stream into lines. Holds back partial lines and partial UTF-8 sequences. */
export class LineSplitter {
  private decoder = new StringDecoder('utf8');
  private rest = '';

  push(chunk: Buffer): string[] {
    this.rest += this.decoder.write(chunk);
    const parts = this.rest.split('\n');
    this.rest = parts.pop() ?? '';
    return parts.map((p) => p.replace(/\r$/, '')).filter((p) => p !== '');
  }

  flush(): string[] {
    const tail = (this.rest + this.decoder.end()).replace(/\r$/, '');
    this.rest = '';
    return tail === '' ? [] : [tail];
  }
}

const MAX_CODE = 200;
const TEST_COMMAND = /\b(?:(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?test|npx\s+(?:vitest|jest|mocha)|vitest|jest|pytest|mocha|cargo\s+test|go\s+test|dotnet\s+test)\b/;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);

function clip(s: string): string {
  const first = s.split(/\r?\n/)[0]!.trim();
  return first.length > MAX_CODE ? first.slice(0, MAX_CODE - 1) + '…' : first;
}

/** Shows a path relative to the project root, with forward slashes. Other paths are left as they are. */
function relPath(p: string, root?: string): string {
  const norm = p.replace(/\\/g, '/');
  if (!root) return norm;
  const r = root.replace(/\\/g, '/').replace(/\/+$/, '');
  if (norm.toLowerCase() === r.toLowerCase()) return '.';
  if (norm.toLowerCase().startsWith(r.toLowerCase() + '/')) return norm.slice(r.length + 1);
  return norm;
}

function toolLine(name: string, input: unknown, root?: string): ParsedLine | null {
  const inp = isObj(input) ? input : {};
  switch (name) {
    case 'Read': {
      const p = str(inp.file_path);
      return p === null ? null : { k: 'read', text: 'Read', code: relPath(p, root) };
    }
    case 'Glob':
    case 'Grep': {
      const p = str(inp.pattern);
      return p === null ? null : { k: 'read', text: 'Read', code: clip(p) };
    }
    case 'Edit':
    case 'Write': {
      const p = str(inp.file_path);
      return p === null ? null : { k: 'edit', text: 'Editing', code: relPath(p, root) };
    }
    case 'Bash':
    case 'PowerShell': {
      const c = str(inp.command);
      if (c === null) return null;
      return { k: 'cmd', text: TEST_COMMAND.test(c) ? 'Running tests' : 'Running', code: clip(c) };
    }
    default:
      return null;
  }
}

function resultContentText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((b) => (isObj(b) && typeof b.text === 'string' ? b.text : '')).join('\n');
  }
  return '';
}

function parseResult(ev: Record<string, unknown>): ClaudeResult {
  const errors = Array.isArray(ev.errors) ? ev.errors.filter((e): e is string => typeof e === 'string') : [];
  const text = str(ev.result) ?? '';
  const denials: Denial[] = [];
  if (Array.isArray(ev.permission_denials)) {
    for (const d of ev.permission_denials) {
      if (isObj(d) && typeof d.tool_name === 'string') denials.push({ tool: d.tool_name, input: d.tool_input });
    }
  }
  return {
    isError: ev.is_error === true,
    resultText: text !== '' ? text : errors.join('\n'),
    terminalReason: str(ev.terminal_reason),
    apiStatus: typeof ev.api_error_status === 'number' ? ev.api_error_status : null,
    denials,
    sessionId: str(ev.session_id),
  };
}

/** Turns one stream-json line into run lines and, for the final event, a result. null = not JSON or nothing to show. */
export function parseEvent(line: string, root?: string): { lines: ParsedLine[]; result?: ClaudeResult } | null {
  let ev: unknown;
  try { ev = JSON.parse(line); } catch { return null; }
  if (!isObj(ev)) return null;

  if (ev.type === 'result') return { lines: [], result: parseResult(ev) };

  const message = isObj(ev.message) ? ev.message : null;
  if (!message || !Array.isArray(message.content)) return null;
  const lines: ParsedLine[] = [];

  if (ev.type === 'assistant') {
    for (const b of message.content) {
      if (!isObj(b) || b.type !== 'tool_use' || typeof b.name !== 'string') continue;
      const l = toolLine(b.name, b.input, root);
      if (l) lines.push(l);
    }
  } else if (ev.type === 'user') {
    for (const b of message.content) {
      if (!isObj(b) || b.type !== 'tool_result' || b.is_error !== true) continue;
      const text = resultContentText(b.content).replace(/<\/?tool_use_error>/g, '').trim();
      lines.push({ k: 'err', text: clip(text) || 'Tool call failed' });
    }
  }
  return lines.length > 0 ? { lines } : null;
}
