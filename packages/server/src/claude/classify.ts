import type { SpecDoc } from '@specboard/core';
import type { ClaudeResult, Denial } from './events.js';

export type RunKind = 'run' | 'write-up' | 'fix-file' | 'refresh-overview';
export type RunStatus = 'running' | 'finished' | 'stopped' | 'needs' | 'permission' | 'error';
export interface EndInfo { status: RunStatus; title?: string; text?: string; fix?: string; denied?: Denial[] }

const AUTH = /authenticate|logged in|\/login/i;
const CLIP_AT = 500;

// ---------- rules ----------

const MULTI_WORD = new Set([
  'git', 'npm', 'npx', 'yarn', 'pnpm', 'cargo', 'go', 'pip', 'pip3', 'docker', 'gh', 'dotnet', 'bun', 'deno', 'kubectl', 'poetry', 'uv',
]);
// A prefix rule on these would let Claude run anything.
export const NEVER_PREFIX = new Set([
  'sh', 'bash', 'zsh', 'dash', 'fish', 'cmd', 'powershell', 'pwsh', 'eval', 'exec', 'sudo', 'su', 'env', 'xargs', 'source',
  'command', 'builtin', 'time', 'nohup', 'timeout', 'nice', 'wsl', 'busybox',
  // PowerShell code runners and process starters, and deleters (a deny list cannot enumerate their flags)
  'iex', 'invoke-expression', 'invoke-command', 'icm', 'start-process', 'saps', 'start', 'call',
  'remove-item', 'ri', 'del', 'erase', 'rd', 'rmdir', 'rm',
]);
/** Lowercase, without trailing dots or a Windows executable extension: GIT, git.exe, git.cmd and `git.` are all git. */
export const normProg = (p: string): string => p.toLowerCase().replace(/\.+$/, '').replace(/\.(?:exe|cmd|bat|com)$/, '');
/** Prefixes that can run or configure arbitrary things: never offered by the UI; a person may still type them. */
const NO_OFFER = new Set([
  'git config', 'git rebase', 'git bisect', 'git filter-branch', 'git submodule', 'git difftool', 'git mergetool',
  'npm exec', 'pnpm dlx', 'pnpm exec', 'yarn dlx', 'yarn exec', 'npx', 'pnpx', 'bunx',
  'go run', 'cargo run', 'dotnet run', 'uv run', 'poetry run', 'docker run', 'docker exec', 'kubectl exec',
  'find', 'awk', 'gawk', 'mawk', 'nawk', 'sed', 'gsed', 'make', 'gmake', 'nmake', 'xargs',
]);
/** Interpreters may be allowed by a person who types the rule, but are never offered by the UI. */
const INTERPRETER = /^(?:node|python[0-9.]*|pypy[0-9.]*|ruby|perl|php|deno|bun)$/;
const FILE_TOOLS = new Set(['Read', 'Glob', 'Grep', 'Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
const SHELL_TOOLS = new Set(['Bash', 'PowerShell']);

/** Splits a shell command on &&, ||, ;, |, & and newlines, outside quotes. null if quotes are unbalanced or a substitution hides a command. */
function splitSegments(cmd: string): string[] | null {
  const segs: string[] = [];
  let cur = '';
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i]!;
    if (quote) {
      if (c === quote) quote = null;
      else if (quote === '"' && (c === '`' || (c === '$' && cmd[i + 1] === '('))) return null;
      cur += c;
      continue;
    }
    if (c === '"' || c === "'") { quote = c; cur += c; continue; }
    if (c === '`' || (c === '$' && cmd[i + 1] === '(')) return null;
    if (c === '&' && (cmd[i - 1] === '>' || cmd[i + 1] === '>')) { cur += c; continue; }
    if (c === '&' || c === '|' || c === ';' || c === '\n' || c === '\r') {
      segs.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  if (quote) return null;
  segs.push(cur);
  return segs.map((s) => s.trim()).filter((s) => s !== '');
}

/** Prefix rule body ("npm install") for one command segment, or null if no safe prefix exists. */
function segmentPrefix(seg: string): string | null {
  const words = seg.split(/\s+/);
  while (words.length > 0 && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[0]!)) words.shift();
  const prog = words[0];
  if (!prog || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(prog)) return null;
  if (NEVER_PREFIX.has(normProg(prog)) || INTERPRETER.test(normProg(prog))) return null;
  const second = words[1];
  const multi = MULTI_WORD.has(normProg(prog)) && second !== undefined && /^[A-Za-z][A-Za-z0-9:_-]*$/.test(second);
  const key = multi ? `${normProg(prog)} ${second.toLowerCase()}` : normProg(prog);
  if (NO_OFFER.has(key) || NO_OFFER.has(normProg(prog))) return null;
  return multi ? `${prog} ${second}` : prog;
}

/** One candidate rule per segment of a shell command, in order. Segments with no safe rule are null. */
function shellSegmentRules(tool: string, command: string): (string | null)[] | null {
  const segs = splitSegments(command);
  if (!segs || segs.length === 0) return null;
  return segs.map((s) => {
    const p = segmentPrefix(s);
    return p === null ? null : `${tool}(${p}:*)`;
  });
}

function isCd(seg: string | null | undefined): boolean {
  return seg !== undefined && seg !== null && /^cd(\s|$)/.test(seg);
}

/** The rule that would let this denied call through, or null when no rule should be offered. */
export function suggestRule(d: Denial): string | null {
  if (FILE_TOOLS.has(d.tool)) return null; // the only rule that could help widens file access
  if (SHELL_TOOLS.has(d.tool)) {
    const command = typeof (d.input as { command?: unknown } | null)?.command === 'string' ? (d.input as { command: string }).command : null;
    if (command === null) return null;
    const segs = splitSegments(command);
    const rules = shellSegmentRules(d.tool, command);
    if (!segs || !rules) return null;
    // The denied segment is unknown without the allow list; skip leading `cd`s, then take the first.
    let i = 0;
    while (i < segs.length - 1 && isCd(segs[i])) i++;
    return rules[i] ?? null;
  }
  return /^[A-Za-z0-9_]+$/.test(d.tool) ? d.tool : null;
}

interface ParsedRule { tool: string; spec: string | null }

function parseRule(rule: string): ParsedRule | null {
  const m = /^([A-Za-z0-9_]+)(?:\(([\s\S]*)\))?$/.exec(rule.trim());
  return m ? { tool: m[1]!, spec: m[2] === undefined || m[2] === '' ? null : m[2].trim() } : null;
}

interface NormSpec { s: string; prefix: boolean; inner: boolean; leading: boolean }

/** Lowercased, program name without .exe etc. `inner`: a wildcard before the end; `leading`: starts with one. */
function normSpec(spec: string): NormSpec {
  const m = /^(.*?)(?::\*|\s\*|\*)$/.exec(spec);
  const body = (m ? m[1]! : spec).trim().replace(/\s+/g, ' ').toLowerCase();
  const words = body.split(' ');
  words[0] = normProg(words[0]!);
  const s = words.join(' ');
  return { s, prefix: m !== null, inner: s.includes('*'), leading: s.startsWith('*') };
}

function covers(a: NormSpec, b: NormSpec): boolean {
  if (a.s === b.s) return a.prefix || !b.prefix;
  return a.prefix && (a.s === '' || b.s.startsWith(a.s + ' '));
}

const SHELLS = new Set(['Bash', 'PowerShell']);
const sameTool = (a: string, b: string): boolean => a === b || (SHELLS.has(a) && SHELLS.has(b));

/** True when `rule` overlaps any deny rule: same tool, and one covers the other. Overlap is treated as denied. */
export function matchesDeny(rule: string, deny: string[]): boolean {
  const r = parseRule(rule);
  if (!r) return true; // unreadable: do not offer it
  for (const raw of deny) {
    const d = parseRule(raw);
    if (!d || !sameTool(d.tool, r.tool)) continue;
    if (d.spec === null || r.spec === null) return true;
    const a = normSpec(r.spec);
    const b = normSpec(d.spec);
    // Wildcards we can't compare literally: a leading one hits every rule of the tool, a mid-pattern one every rule of the same program.
    if (a.leading || b.leading) return true;
    if ((a.inner || b.inner) && a.s.split(' ')[0] === b.s.split(' ')[0]) return true;
    if (covers(a, b) || covers(b, a)) return true;
  }
  return false;
}

/** The rule to offer for a denial, or null when it can't or shouldn't be allowed (no rule, or it meets a deny rule). */
function offerableRule(d: Denial, deny: string[]): string | null {
  const rule = suggestRule(d);
  if (rule === null || matchesDeny(rule, deny)) return null;
  if (SHELL_TOOLS.has(d.tool)) {
    const command = (d.input as { command?: string }).command!;
    for (const r of shellSegmentRules(d.tool, command) ?? []) {
      if (r !== null && matchesDeny(r, deny)) return null;
    }
  }
  return rule;
}

function describe(d: Denial): string {
  const inp = (d.input ?? {}) as { command?: unknown; file_path?: unknown };
  const what = typeof inp.command === 'string' ? inp.command : typeof inp.file_path === 'string' ? inp.file_path : '';
  const first = what.split(/\r?\n/)[0]!.trim();
  const short = first.length > 80 ? first.slice(0, 79) + '…' : first;
  return short ? `${d.tool} \`${short}\`` : d.tool;
}

// ---------- end state ----------

export interface ClassifyInput {
  stopped: boolean;
  exitCode: number | null;
  result: ClaudeResult | null;
  stderrTail: string;
  kind: RunKind;
  before: SpecDoc | null;
  after: SpecDoc | null;
  denyRules?: string[];
}

const NOT_LOGGED_IN: EndInfo = {
  status: 'error',
  title: "Claude Code isn't logged in",
  text: 'Run `claude` in a terminal and log in, then run again.',
};

function lastLine(s: string): string {
  const lines = s.split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== '');
  return lines[lines.length - 1] ?? '';
}

/** A denial as clients get it: what is shown, not a whole file's contents. Rules are worked out before this. */
function forWire(d: Denial): Denial {
  const inp = (d.input ?? {}) as { command?: unknown; file_path?: unknown };
  const input: Record<string, string> = {};
  if (typeof inp.command === 'string') input.command = clipped(inp.command);
  if (typeof inp.file_path === 'string') input.file_path = clipped(inp.file_path);
  return { tool: d.tool, input };
}

const clipped = (s: string): string => (s.length > CLIP_AT ? s.slice(0, CLIP_AT - 1) + '…' : s);

/** What Claude said it stopped for: the board's own wording can't know that. */
function claudeSaid(result: ClaudeResult): string {
  const said = result.resultText.replace(/\s+/g, ' ').trim();
  return said === '' ? '' : ` Claude said: ${clipped(said)}`;
}

function permissionEnd(denials: Denial[], deny: string[]): EndInfo {
  const fixable: string[] = [];
  const blocked: Denial[] = [];
  for (const d of denials) {
    const rule = offerableRule(d, deny);
    if (rule === null) blocked.push(d);
    else if (!fixable.includes(rule)) fixable.push(rule);
  }
  const names = (ds: Denial[]) => [...new Set(ds.map(describe))].join(', ');
  const info: EndInfo = { status: 'permission', title: 'Claude needs permission', denied: denials.map(forWire) };
  if (fixable.length === 0) {
    info.text = `Claude was stopped from using ${names(denials)}. This action is blocked by this project's rules.`;
    return info;
  }
  info.fix = fixable.map((r) => `specboard allow "${r}"`).join('\n');
  info.text = blocked.length > 0
    ? `Claude was stopped from using ${names(denials.filter((d) => !blocked.includes(d)))}. Allow it, then run again. ${names(blocked)} stays blocked by this project's rules.`
    : `Claude was stopped from using ${names(denials)}. Allow it for this project, then run again.`;
  return info;
}

/** A run that reached Review despite refusals is not a permission end, but the person should hear about them. */
function withRefusals(info: EndInfo, denials: Denial[]): EndInfo {
  if (denials.length === 0) return info;
  const line = `Claude was refused ${denials.length === 1 ? '1 action' : `${denials.length} actions`} on the way. Check the result before moving this to Done.`;
  return { ...info, denied: denials.map(forWire), text: info.text ? `${info.text} ${line}` : line };
}

export function classifyEnd(input: ClassifyInput): EndInfo {
  const { stopped, exitCode, result, stderrTail, kind, before, after } = input;
  if (stopped) return { status: 'stopped' };

  if (result?.isError) {
    if (result.apiStatus === 401 || AUTH.test(result.resultText)) return { ...NOT_LOGGED_IN };
    return { status: 'error', title: 'Claude Code reported an error', text: result.resultText || 'Claude Code ended with an error.' };
  }
  if (!result) {
    if (AUTH.test(stderrTail)) return { ...NOT_LOGGED_IN };
    const code = exitCode === null ? 'Claude Code exited unexpectedly' : `Claude Code exited with code ${exitCode}`;
    const tail = lastLine(stderrTail);
    return { status: 'error', title: code, text: tail || undefined };
  }

  const afterInReview = after?.status === 'review';
  const unanswered = (s: SpecDoc | null) => (s?.questions ?? []).filter((q) => q.answer === null);
  const wasOpen = new Set(unanswered(before).map((q) => q.id));
  const open = unanswered(after);
  const needs = () => withRefusals({
    status: 'needs',
    title: 'Claude has a question',
    text: open.length === 1 ? 'There is 1 unanswered question on this spec.' : `There are ${open.length} unanswered questions on this spec.`,
  }, result.denials);

  // The skill adds no question for a refusal, so a new question is a real decision: it comes before any refusal.
  if (kind === 'run' && open.some((q) => !wasOpen.has(q.id))) return needs();
  if (result.denials.length > 0 && !afterInReview) return permissionEnd(result.denials, input.denyRules ?? []);

  if (kind !== 'run') return withRefusals({ status: 'finished' }, result.denials);

  if (open.length > 0 && !afterInReview) return needs();
  if (afterInReview) return withRefusals({ status: 'finished' }, result.denials);

  const left = (after?.subtasks ?? []).filter((t) => !t.done).map((t) => t.n);
  const why = !after
    ? 'The spec could not be read after the run.'
    : left.length > 0
      ? `Subtasks left: ${left.join(', ')}.`
      : 'No subtasks are left, but the spec is not in Review.';
  return { status: 'error', title: 'Claude stopped before finishing', text: why + claudeSaid(result) };
}
