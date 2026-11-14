// Stands in for `claude -p` in RunManager tests: node fake-claude.mjs <scenario> <recordFile> ...<the real claude args>
// Records its arguments and environment, then applies the scenario to the spec files in its cwd and writes stream-json.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [scenario, recordFile, ...args] = process.argv.slice(2);
fs.writeFileSync(recordFile, JSON.stringify({ args, env: process.env, cwd: process.cwd() }));

const specFile = () => {
  const specs = path.join('.specboard', 'specs');
  return path.join(specs, fs.readdirSync(specs)[0], 'spec.md');
};
const editSpec = (fn) => fs.writeFileSync(specFile(), fn(fs.readFileSync(specFile(), 'utf8')));
const writeLog = (n, slug, commit) => {
  const dir = path.join(path.dirname(specFile()), 'logs');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${n}-${slug}.md`), `---\nsubtask: ${n}\ncommit: ${commit}\nfiles: [a.txt]\n---\n\n### 2026-11-09 10:00\nDid it.\n`);
};
const emit = (o) => process.stdout.write(JSON.stringify(o) + '\n');
const result = (extra = {}) => emit({ type: 'result', subtype: 'success', is_error: false, result: 'done', terminal_reason: 'completed', session_id: 's', permission_denials: [], ...extra });
const denied = (command) => result({ permission_denials: [{ tool_name: 'Bash', tool_use_id: 't', tool_input: { command } }] });

/** Writes a counter to the file in argv[1] every 50 ms and gives up by itself after 60 s, so a failed test cannot leak it for long. */
const HEARTBEAT = `const fs=require('fs');let n=0;setInterval(()=>fs.writeFileSync(process.argv[1],String(++n)),50);setTimeout(()=>process.exit(0),60000);`;
const heartbeatFile = path.resolve(`${recordFile}.heartbeat`);
const pidFile = path.resolve(`${recordFile}.pid`);

const hang = () => {
  process.on('SIGTERM', () => {}); // a hung child that does not listen
  setInterval(() => {}, 1000);
  setTimeout(() => process.exit(9), 60000);
};

const scenarios = {
  success() {
    editSpec((t) => t.replace(/^status: .*$/m, 'status: review').replace(/^- \[ \] (\d+)\./gm, '- [x] $1.'));
    writeLog(1, 'first', 'aaa1111');
    writeLog(2, 'second', 'bbb2222');
    const replay = fs.readFileSync(path.join(import.meta.dirname, 'claude', 'ok-tools.jsonl'), 'utf8');
    process.stdout.write(replay.replaceAll('<ROOT>', JSON.stringify(process.cwd()).slice(1, -1)));
  },
  plain: () => result(),
  leftover() {
    editSpec((t) => t.replace(/^current_subtask: .*$/m, 'current_subtask: 2'));
    result();
  },
  question() {
    editSpec((t) => t.replace('## Subtasks', '## Open questions\n- [ ] Q1 (text): Which one?\n  > answer:\n\n## Subtasks'));
    result();
  },
  'you-step'() {
    editSpec((t) => t.replace('- [ ] 1. First', '- [x] 1. First').replace('- [ ] 2. Second', '- [ ] 2. (you) Add the key'));
    result();
  },
  'you-final'() {
    editSpec((t) => t.replace(/^status: .*$/m, 'status: review').replace('- [ ] 1. First', '- [x] 1. First').replace('- [ ] 2. Second', '- [ ] 2. (you) Check it on your phone'));
    writeLog(1, 'first', 'aaa1111');
    result();
  },
  // 10000 + 8000 + 30000 + 210 = 48210 tokens
  tokens: () => result({ total_cost_usd: 0.5, usage: { input_tokens: 10000, output_tokens: 8000, cache_read_input_tokens: 30000, cache_creation_input_tokens: 210 } }),
  'sync-plan'() {
    const text = ["---", "created: \"2026-11-14 10:00\"", "head: \"abc1234\"", "changes: 1", "---", "", "## Summary", "One.", "", "## Operations", "1. Archive T-001 (done)", ""].join('\n');
    fs.writeFileSync(path.join(".specboard", "sync-proposal.md"), text);
    result();
  },
  // Marks the first spec done, so a proposal can archive it.
  'mark-done'() {
    editSpec((t) => t.replace(/^status: .*$/m, 'status: done'));
    result();
  },
  'denied-push': () => denied('git push origin HEAD'),
  'denied-npm': () => denied('npm install date-fns'),
  crash() {
    emit({ type: 'system', subtype: 'init' });
    process.stderr.write('boom: the last line\n');
    process.exitCode = 3;
  },
  flood() {
    for (let i = 0; i < 2100; i++) emit({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: `git status ${i}` } }] } });
    result();
  },
  // Hangs with a grandchild in its tree. Detached, because on Windows a plain child of Node dies with its parent (libuv's
  // job object), and then killing only this process would pass too. taskkill /T must really walk the tree.
  hang() {
    const child = spawn(process.execPath, ['-e', HEARTBEAT, heartbeatFile], { stdio: 'ignore', detached: true });
    fs.writeFileSync(pidFile, String(child.pid));
    hang();
  },
  idle: () => hang(),
  // Ends by itself while a grandchild keeps the output pipe open.
  'orphan-exit'() {
    const child = spawn(process.execPath, ['-e', HEARTBEAT, heartbeatFile], { stdio: ['ignore', 'inherit', 'inherit'], detached: true });
    fs.writeFileSync(pidFile, String(child.pid));
    child.unref();
    result();
  },
  // Hangs while a process outside its tree (its parent has gone) keeps the output pipe open, so `close` lags after a stop.
  'lagging-close'() {
    const launcher = `const {spawn}=require('child_process');const c=spawn(process.execPath,['-e',process.argv[1],process.argv[2]],{stdio:['ignore','inherit','inherit'],detached:true});require('fs').writeFileSync(process.argv[3],String(c.pid));c.unref();`;
    spawn(process.execPath, ['-e', launcher, HEARTBEAT, heartbeatFile, pidFile], { stdio: ['ignore', 'inherit', 'inherit'] });
    hang();
  },
};

const run = scenarios[scenario];
if (!run) throw new Error(`Unknown scenario ${scenario}`);
run();
