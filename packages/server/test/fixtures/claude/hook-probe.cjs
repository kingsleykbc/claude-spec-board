// Probe: which parts of a project does a headless `claude -p` run load? Not part of the test suite.
// usage: node hook-probe.cjs <work-dir> <out-dir>      (needs a logged-in `claude`; spends a few haiku turns per run)
// Writes <out-dir>/hooks-<run>.jsonl (sanitised captures) and prints a summary JSON.
const spawn = require('cross-spawn'); // resolved from the repo's node_modules
const fs = require('fs');
const os = require('os');
const path = require('path');

const work = path.resolve(process.argv[2]);
const outDir = path.resolve(process.argv[3]);
const repo = path.join(work, 'hook');
const plugin = path.join(work, 'probe-plugin');
const shimDir = path.join(work, 'shim');
const fwd = (p) => p.replace(/\\/g, '/');

// ---- sanitising: temp paths, home, user name, personal plugin and connector names ----
const home = os.homedir();
const user = os.userInfo().username;
const sub = (s) =>
  String(s)
    .split(fwd(work)).join('<TMP>').split(work).join('<TMP>').split(work.replace(/\\/g, '\\\\')).join('<TMP>')
    .split(fwd(home)).join('<HOME>').split(home).join('<HOME>').split(home.replace(/\\/g, '\\\\')).join('<HOME>')
    .split(user).join('<USER>')
    .replace(/C--Users-[A-Za-z0-9._<>-]+/g, '<ENCODED_PATH>');

// ---- fixture project ----
function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}
const SKILL = `---
name: probe
description: Probe skill
---
Arguments: $ARGUMENTS

Work in the current working directory (the project root), not in the skill folder.
1. Use the Read tool on notes.txt in the project root.
2. Use the Write tool to create out.txt in the project root containing exactly: hello $ARGUMENTS
3. Use the Bash tool to run: touch proj.txt
If a step is refused, say which one and carry on.
`;
const hook = (marker) => ({ type: 'command', command: `node -e "require('fs').writeFileSync('${marker}','1')"` });
fs.rmSync(work, { recursive: true, force: true });
write(path.join(repo, 'notes.txt'), 'note one\n');
write(path.join(repo, 'CLAUDE.md'), 'The project codeword is PINEAPPLE-7.\n');
write(path.join(repo, '.mcp.json'), JSON.stringify({ mcpServers: { ghost: { command: 'specboard-nonexistent-xyz', args: [] } } }));
write(path.join(repo, '.claude', 'skills', 'probe', 'SKILL.md'), SKILL);
write(
  path.join(repo, '.claude', 'settings.json'),
  JSON.stringify({
    permissions: { allow: ['Bash(touch:*)'] },
    hooks: { PreToolUse: [{ matcher: '*', hooks: [hook('pre-marker.txt')] }], SessionStart: [{ hooks: [hook('session-marker.txt')] }] },
  }),
);
write(path.join(plugin, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: 'probe-plugin', description: 'hook probe plugin', version: '0.0.1' }));
write(path.join(plugin, 'skills', 'probe', 'SKILL.md'), SKILL);
spawn.sync('git', ['init', '-q'], { cwd: repo });

// ---- argv echo shims (what does cross-spawn really hand over?) ----
write(path.join(shimDir, 'echo-argv.cjs'), 'process.stdout.write(JSON.stringify(process.argv.slice(2)));\n');
write(path.join(shimDir, 'echo-argv.cmd'), '@node "%~dp0echo-argv.cjs" %*\r\n');

// ---- the four configurations ----
const ALLOW = ['Read(./**)', 'Edit(./**)', 'Write(./**)'];
const settings = JSON.stringify({ permissions: { allow: ALLOW } });
const settingsNoHooks = JSON.stringify({ disableAllHooks: true, permissions: { allow: ALLOW } });
const common = ['--model', 'haiku', '--output-format', 'stream-json', '--verbose', '--permission-mode', 'dontAsk', '--max-turns', '8'];
const CODEWORD_PROMPT = 'State the codeword from your instructions, or say none.';
const runs = {
  A: { prompt: '/probe alpha42', extra: [], settings },
  B: { prompt: '/probe-plugin:probe alpha42', extra: ['--setting-sources', '', '--plugin-dir', plugin], settings },
  B2: { prompt: '/probe alpha42', extra: ['--setting-sources', ''], settings },
  C: { prompt: '/probe alpha42', extra: [], settings: settingsNoHooks },
};

const env = { ...process.env, MSYS_NO_PATHCONV: '1' };
for (const k of Object.keys(env)) if (/^(CLAUDE|ANTHROPIC)/i.test(k)) delete env[k];

const MARKERS = ['pre-marker.txt', 'session-marker.txt', 'out.txt', 'proj.txt'];
const clearMarkers = () => MARKERS.forEach((f) => fs.rmSync(path.join(repo, f), { force: true }));
const listing = () => fs.readdirSync(repo).filter((f) => f !== '.git').sort();
const argvText = (argv) => argv.map((a) => (a === '' ? '<EMPTY-STRING>' : sub(a)));

// Keep the shape of the init event; replace personal plugin, connector and skill names by placeholders and counts.
function sanitiseInit(init) {
  const keepSkill = (s) => s === 'probe' || s === 'probe-plugin:probe';
  const names = (list) => ({ count: list.length, kept: list.filter(keepSkill), other: list.filter((s) => !keepSkill(s)).length });
  const bucket = (m) => {
    const src = m.source === 'claudeai' ? '<CONNECTOR>' : m.source === 'plugin' ? '<USER_PLUGIN>:mcp' : m.source === 'user' ? '<USER_MCP>' : m.name;
    return { name: src, source: m.source, status: m.status };
  };
  const plugin = (p) => {
    const builtin = p.path === 'builtin';
    const inline = String(p.source).endsWith('@inline');
    return { name: builtin || inline ? p.name : '<USER_PLUGIN>', source: builtin || inline ? p.source : '<USER_PLUGIN>@<MARKETPLACE>' };
  };
  const rest = { ...init };
  delete rest.slash_commands; delete rest.skills; delete rest.mcp_servers; delete rest.plugins; delete rest.tools; delete rest.agents;
  return JSON.parse(sub(JSON.stringify({
    ...rest,
    tools: { count: (init.tools || []).length },
    slash_commands: names(init.slash_commands || []),
    skills: names(init.skills || []),
    mcp_servers: (init.mcp_servers || []).map(bucket),
    plugins: (init.plugins || []).map(plugin),
  })));
}

function run(name, prompt, cfg, withMarkers) {
  clearMarkers();
  const argv = ['-p', prompt, ...common, '--settings', cfg.settings, ...cfg.extra];
  const r = spawn.sync('claude', argv, { cwd: repo, env, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', timeout: 240000 });
  const events = (r.stdout || '').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const init = events.find((e) => e.type === 'system' && e.subtype === 'init') || {};
  const res = events.find((e) => e.type === 'result') || {};
  const systemSubtypes = [...new Set(events.filter((e) => e.type === 'system').map((e) => e.subtype))];
  const initText = JSON.stringify(init);
  const meta = {
    type: 'probe-meta', run: name, prompt: sub(prompt),
    argv: ['claude', ...argvText(argv)],
    exit: r.status, signal: r.signal || null,
    stderr: sub(r.stderr || ''),
    repo_listing_after: withMarkers ? listing() : undefined,
    system_subtypes: systemSubtypes,
    init_mentions_claude_md: /CLAUDE\.md/i.test(initText),
    init_has_memory_paths_key: 'memory_paths' in init, // an auto-memory folder path, not a list of loaded CLAUDE.md files
  };
  const lines = [meta, { type: 'init', ...sanitiseInit(init) }];
  for (const e of events) {
    if (e.type === 'assistant') {
      for (const b of e.message.content || []) if (b.type === 'tool_use') lines.push({ type: 'tool_use', name: b.name, input: JSON.parse(sub(JSON.stringify(b.input))) });
    } else if (e.type === 'system' && /^hook_/.test(e.subtype)) {
      // Keep which hook ran and how it ended, never its output (a plugin's hook output can be long and personal).
      lines.push({
        type: 'hook_event', subtype: e.subtype, hook_event: e.hook_event, hook_name: e.hook_name,
        outcome: e.outcome, exit_code: e.exit_code, output_bytes: (e.output || e.stdout || '').length,
      });
    } else if (e.type === 'system' && e.subtype === 'permission_denied') {
      lines.push({ type: 'permission_denied', tool_name: e.tool_name, decision_reason_type: e.decision_reason_type });
    } else if (e.type === 'result') {
      lines.push({ type: 'result', subtype: e.subtype, is_error: e.is_error, permission_denials: (e.permission_denials || []).map((d) => ({ tool_name: d.tool_name })), result: sub(e.result || '') });
    }
  }
  fs.writeFileSync(path.join(outDir, `hooks-${name}.jsonl`), lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
  return { exit: r.status, listing: withMarkers ? listing() : undefined, result: String(res.result || '') };
}

fs.mkdirSync(outDir, { recursive: true });
const summary = { shims: {}, runs: {} };

// What a spawned program receives for the same arguments (plain node script, and a .cmd shim).
for (const [name, cfg] of Object.entries(runs)) {
  const argv = ['-p', cfg.prompt, ...common, '--settings', cfg.settings, ...cfg.extra];
  const viaNode = spawn.sync(process.execPath, [path.join(shimDir, 'echo-argv.cjs'), ...argv], { encoding: 'utf8' });
  const viaCmd = spawn.sync(path.join(shimDir, 'echo-argv.cmd'), argv, { encoding: 'utf8' });
  const received = (o) => { try { return JSON.parse(o.stdout); } catch { return null; } };
  const same = (a) => a !== null && a.length === argv.length && a.every((x, i) => x === argv[i]);
  summary.shims[name] = {
    node_received_count: received(viaNode)?.length, node_identical: same(received(viaNode)),
    cmd_received_count: received(viaCmd)?.length, cmd_identical: same(received(viaCmd)),
    empty_arg_kept_node: (received(viaNode) || []).includes(''), empty_arg_kept_cmd: (received(viaCmd) || []).includes(''),
    expected_count: argv.length,
    cmd_received_sanitised: received(viaCmd) && received(viaCmd).map((a) => (a === '' ? '<EMPTY-STRING>' : sub(a))),
  };
}

// User-level hooks in this environment: key presence and counts only, never values.
try {
  const us = JSON.parse(fs.readFileSync(path.join(home, '.claude', 'settings.json'), 'utf8'));
  const hooks = us.hooks && typeof us.hooks === 'object' ? us.hooks : null;
  summary.user_hooks = { has_hooks_key: hooks !== null, event_names_count: hooks ? Object.keys(hooks).length : 0, entries_count: hooks ? Object.values(hooks).reduce((n, v) => n + (Array.isArray(v) ? v.length : 1), 0) : 0 };
} catch {
  summary.user_hooks = { settings_file_readable: false };
}

for (const [name, cfg] of Object.entries(runs)) {
  const a = run(name, cfg.prompt, cfg, true);
  const b = run(`${name}-codeword`, CODEWORD_PROMPT, cfg, false);
  summary.runs[name] = { exit: a.exit, listing_after: a.listing, codeword_run_exit: b.exit, codeword_reply: sub(b.result).slice(0, 200) };
}
console.log(JSON.stringify(summary, null, 2));
