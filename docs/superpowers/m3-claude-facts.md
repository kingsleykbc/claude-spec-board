# M3: how the real `claude` CLI behaves

Captured 2026-11-08 on Windows 11 with Claude Code 2.1.302 (`claude auth status`: logged in, claude.ai subscription), model `--model haiku` (resolves to `claude-haiku-5-5`). Fixtures: `packages/server/test/fixtures/claude/*.jsonl`.

## How the probes ran

- Every probe ran from a Node script using `child_process.spawn('claude', args, { stdio: ['ignore','pipe','pipe'], shell: false })`. `claude` resolves to `claude.exe`, so no shell is needed.
- All `CLAUDE*` and `ANTHROPIC*` variables were removed from the child environment (the probes were launched from inside a Claude Code session).
- The cwd was a fresh temp git repo outside the Spec Board repo, with `.claude/skills/probe/SKILL.md` (takes `$ARGUMENTS`; asks for Read `notes.txt`, Write `out.txt`, Bash `git status`). I never answered a trust dialog and never touched trust settings or `~/.claude*`. I did not inspect whether the folder is recorded as trusted; in `-p` mode there is no dialog at all (see Q1).
- Command line that worked (argument array, no shell):

```
claude -p "/probe alpha42" --model haiku --output-format stream-json --verbose \
  --permission-mode dontAsk --max-turns 8 --settings '<json>'
```

`<json>` for the main probes: `{"permissions":{"allow":["Read(./**)","Edit(./**)","Write(./**)","Bash(git status:*)","Bash(git diff:*)","Bash(git commit:*)"]}}`. `--settings` accepts inline JSON. `--verbose` is required for stream-json with `-p`.

- Fixture trimming: `system` events with subtype `hook_started`, `hook_response` and `thinking_tokens` were dropped (the hook output is huge and personal), as were `rate_limit_event` lines. The `init` event keeps its keys but `skills`, `plugins`, `mcp_servers`, `slash_commands`, `agents`, `memory_paths` are emptied and `mcp__*` tools removed. Thinking `signature`s are replaced by `<SIGNATURE>`. Paths are `<ROOT>` (the project cwd) and `<SCRATCH>` (its parent), session ids are `<SESSION>`, e-mail addresses `<EMAIL>`. Everything else is verbatim, one real JSON object per line. Grep for `Kingsley`, `xaviourchubie`, `@`, `AppData` is clean.

## Gotcha: Git Bash rewrites a leading `/` argument

Running the same command from Git Bash turned `"/probe alpha42"` into `C:/Program Files/Git/probe alpha42` (MSYS path conversion), and the model then called the `Skill` tool with that garbage. That is a shell artefact, not a CLI one: spawning from Node with an argument array passes `/probe alpha42` unchanged. Tests and manual probes must not go through Git Bash without `MSYS_NO_PATHCONV=1`.

## Q1. Does `--settings` + `dontAsk` allow listed tools and refuse others in an untrusted folder?

Yes (`ok-tools.jsonl`, `denied.jsonl`, `no-settings.jsonl`).

- `-p` (print) mode shows no trust dialog and the project skill still loaded and ran. Listed rules applied: `Read(./**)`, `Write(./**)`, `Bash(git status:*)` ran with `permission_denials: []`, exit code 0, and `out.txt` was created.
- Unlisted: `npm --version` was refused (`denied.jsonl`).
- Without any `--settings` (`no-settings.jsonl`), `dontAsk` still permits read-only things (Read, `git status`) but refuses Write. So the approved list is what grants write/exec power.
- Skill invocation: with a correct `/probe alpha42` prompt the CLI expands the skill before the model runs. There is no `Skill` tool_use and no extra `user` event in the stream; `$ARGUMENTS` was substituted (`out.txt` contained `hello alpha42`). The `Skill` tool needs no allow rule.

## Q2. Rule syntax for Edit/Write; writes outside the project

- `Edit(./**)` and `Write(./**)` scope to the project directory. A `Write` to an absolute path outside the project (a sibling folder that exists) was refused and nothing was created (`outside-write.jsonl`).
- Tool inputs carry absolute Windows paths with backslashes (`"file_path":"<ROOT>\\out.txt"`), and the rules still matched.
- Keep rules in this `Tool(specifier)` form; a `:*` suffix on Bash rules is a prefix match.

## Q3. `Bash(git commit:*)` and PowerShell

- `Bash(git commit:*)` works under Git Bash: a plain `git commit -m probe-commit` ran with no denial and the commit landed (checked with `git log`; not a committed fixture). A compound `git add d.txt && git commit -m compound` passed when `Bash(git add:*)` and `Bash(git commit:*)` were listed (`bash-compound.jsonl`: one `Bash` tool_use with the `&&` command, `permission_denials: []`, commit landed).
- **A `PowerShell` tool exists** in the tool list on Windows (`init.tools`). When told to use it, the model does (`powershell-readonly.jsonl`). When just asked to "list the files with a shell command" it chose `Bash` (`shell-command-bash.jsonl`; one sample, the model could differ).
- Bash rules do NOT cover it: `PowerShell` running `git commit ...` was denied (`powershell-denied.jsonl`) and so was `Set-Content`. The read-only PowerShell command `git status` ran with no PowerShell rule (`powershell-readonly.jsonl`, `permission_denials: []`).
- `PowerShell(git commit:*)` as an allow rule works (the same command then passed: `powershell-allowed.jsonl`). Decision for M3: do NOT add PowerShell rules; leaving PowerShell write access denied is the safe default. The skills should say "use the Bash tool".

## Q4. SIGTERM / `taskkill`

- `child.kill('SIGTERM')` from Node on Windows terminates `claude.exe` immediately. Node reports `code: null, signal: 'SIGTERM'`. The stream stops mid-way, with no `result` event (`sigterm.jsonl` was only checked, not committed: it holds only startup lines). The `close` event came about 6 s after the kill, probably because child processes held the stdout pipe open. Use `exit` plus a timeout, or kill the tree, rather than waiting on `close`.
- `taskkill /PID <pid>` (no `/F`) fails: "can only be terminated forcefully". The run kept going and finished normally (exit 0).
- `taskkill /PID <pid> /T /F` kills `claude.exe` and its child processes (8 processes in total). Exit code seen by Node: `1`, signal `null`. No stray `claude.exe` remained afterwards.
- So for cancel: use `taskkill /PID <pid> /T /F` (tree) on Windows. Do not rely on a graceful stop and do not expect a `result` event.

## Stream shapes (see fixtures)

Event order for a normal run (`ok-tools.jsonl`): `system/init`, `assistant` (thinking block), `assistant` (tool_use), `user` (tool_result), ..., `assistant` (text), `result`. Each content block of one model message arrives as its own `assistant` line, all sharing `message.id`. Parallel tool calls appear as consecutive assistant lines before the matching `user` lines.

- `init`: `session_id`, `cwd`, `tools`, `model`, `permissionMode` ("dontAsk"), `claude_code_version`, `apiKeySource`.
- tool_use block: `{"type":"tool_use","id":"toolu_..","name":"Read","input":{"file_path":"<ROOT>\\notes.txt"},"caller":{"type":"direct"}}`. Names seen: `Read`, `Write`, `Edit`, `Bash` (input `command`, `description`), `PowerShell`, `Skill` (input `skill`, `args`).
- tool_result is a `user` line: `message.content[0] = {"tool_use_id","type":"tool_result","content":"<string>","is_error":false}` (`is_error` can be absent on success, `true` on a denial). The `user` line also has a top-level `tool_use_result` object with richer data (for Read: `{type:"text", file:{filePath, content, numLines,...}}`).
- Other `assistant` keys: `session_id`, `uuid`, `timestamp`, `parent_tool_use_id` (null at top level), `request_id`.
- `result` event (success): `type:"result"`, `subtype:"success"`, `is_error:false`, `result:"done"` (final assistant text), `num_turns`, `stop_reason:"end_turn"`, `terminal_reason:"completed"`, `session_id`, `total_cost_usd`, `duration_ms`, `usage`, `modelUsage`, `permission_denials:[]`.
- `result` (failure, `error-max-turns.jsonl`, `--max-turns 1`): `subtype:"error_max_turns"`, `is_error:true`, `errors:["Reached maximum number of turns (1)"]`, `terminal_reason:"max_turns"`, process exit code **1**.
- Bad model (`bad-model.jsonl`, `--model nosuchmodel`): exit code 1, stderr `[claude-code:unrecognized_model] {...}`. The stream is `init`, a synthetic assistant message, and a `result` with **`subtype:"success"` but `is_error:true`, `terminal_reason:"api_error"`, `api_error_status:404`**, error text in `result`. `subtype` is NOT the failure signal here: use `is_error`, `terminal_reason` and the exit code.
- `system/permission_denied` (live event, emitted when a tool call is refused, before the matching `user` tool_result): `{"type":"system","subtype":"permission_denied","tool_name":"Bash","tool_use_id":"toolu_..","decision_reason_type":"mode"|"rule","message":"..","uuid":"..","session_id":".."}`. `decision_reason_type:"mode"` means no allow rule matched, so `dontAsk` refused it (message "...because Claude Code is running in don't ask mode..."). `"rule"` means an explicit `deny` rule matched (message "Permission to use Bash with command git status has been denied."). Present in denied, deny-rule, outside-write, claude-dir-write, powershell-denied, recommended. Caveat: a Write/Edit refused by an explicit deny rule on a path (`claude-dir-deny.jsonl`) emitted NO such event; it has only the `tool_use_error` tool_result and the `permission_denials` entry. So the final `permission_denials` array is the complete list; the events are not.
- `--max-turns N` counts tool round trips; it stops with the failure above, so leave headroom.

## Denials (`denied.jsonl`, `deny-rule.jsonl`)

- A denied tool call does **not** stop the run. The `tool_result` has `is_error:true` with text such as `Permission to use Bash has been denied because Claude Code is running in don't ask mode. IMPORTANT: You *may* attempt to ... other tools ...`; the model then continues and explains, ending with a normal `result`.
- A denied run still ends with `subtype:"success"`, `is_error:false`, `terminal_reason:"completed"`, and **exit code 0**. Machine-readable signals are the live `system/permission_denied` events (see Stream shapes) and the `permission_denials` array in the final `result`.
- `permission_denials` shape (array in the final `result`): `{"tool_name":"Bash","tool_use_id":"toolu_..","tool_input":{"command":"npm --version","description":"Print npm version"}}`. For Write it holds `file_path` and `content`; for Edit `file_path`, `old_string`, `new_string`, `replace_all`.
- **Is that enough to build a rule?** Yes for Bash (exact `command` string, so `Bash(npm --version)` or a prefix `Bash(npm:*)`), and for Edit/Write (tool name and absolute `file_path`). It is complete per tool call, including compound or multi-line commands, so the UI should offer an exact or prefix rule and let the human choose. The list is only in the final `result`; a killed run has none.
- `permissions.deny` beats `permissions.allow`: with `Bash(git status:*)` in both, `git status` was denied (`deny-rule.jsonl`; `tool_result` text `Permission to use Bash with command git status has been denied.`, and the denial is listed in `permission_denials`).

## Dot-directories, `.specboard/` and `.claude/`

- `Write(./**)` and `Edit(./**)` DO match ordinary dot-directories. An Edit of the existing `.specboard/specs/x.md` (`todo` to `doing`, verified on disk) and a Write of a new `.specboard/specs/new.md` both succeeded with `permission_denials: []` (`dot-specboard-glob.jsonl`). A Write to `.foo/x.txt` also succeeded (`dot-other.jsonl`). No separate `Write(./.specboard/**)` rule is needed.
- `.claude/` is the exception. With only `Write(./**)` allowed, a Write to `.claude/skills/probe/EXTRA.md` was refused with `decision_reason_type:"mode"` (`claude-dir-write.jsonl`): `./**` does not grant `.claude/` (a built-in protection for that directory; other dot paths are unaffected, as the two runs above show).
- Explicit deny: `deny: ["Edit(./.claude/**)","Write(./.claude/**)"]` refuses a new-file Write and an Edit of `SKILL.md` with `<tool_use_error>File is in a directory that is denied by your permission settings.</tool_use_error>`, listed in `permission_denials` but with no `permission_denied` event (`claude-dir-deny.jsonl`). Ship the deny rules so the result does not depend on the built-in default.
- **Recommended allow list** (`recommended.jsonl`, one run asking for four Writes): allow `Read(./**)`, `Edit(./**)`, `Write(./**)` plus the Bash prefixes the skills need (`git status`, `git add`, `git commit`, ...); deny `Edit(./.claude/**)`, `Write(./.claude/**)`. Result: `.specboard/specs/y.md` and `src/z.txt` were written; `.claude/hooks-test.md` (explicit deny) and a path outside the project (`mode`) were refused. Project files and `.specboard/` are writable; `.claude/` and the outside world are not.

## Settings JSON used per fixture

Base set A = `{"permissions":{"allow":["Read(./**)","Edit(./**)","Write(./**)","Bash(git status:*)","Bash(git diff:*)","Bash(git commit:*)"]}}`. Every run used `--model haiku --output-format stream-json --verbose --permission-mode dontAsk --max-turns 8`, except error-max-turns (`--max-turns 1`) and bad-model (`--model nosuchmodel --max-turns 1`).

| Fixture | --settings | Prompt gist |
|---|---|---|
| ok-tools | A | `/probe alpha42` |
| no-settings | flag omitted | `/probe alpha42` |
| denied | A | run `npm --version` |
| deny-rule | allow Read/Edit/Write(./**), `Bash(git status:*)`, `Bash(git commit:*)`; deny `Bash(git status:*)` | run `git status` |
| outside-write | A | Write to an existing folder outside the project |
| claude-dir-write | A | Write `.claude/skills/probe/EXTRA.md` |
| claude-dir-deny | allow Read/Edit/Write(./**); deny `Edit(./.claude/**)`, `Write(./.claude/**)` | Write EXTRA.md, Edit SKILL.md under `.claude` |
| dot-specboard-glob | A | Edit `.specboard/specs/x.md`, Write `.specboard/specs/new.md` |
| dot-other | A | Write `.foo/x.txt` |
| recommended | A + `Bash(git add:*)` + the two `.claude` deny rules | four Writes: `.specboard`, `src`, `.claude`, outside |
| bash-compound | allow Read/Edit/Write(./**), `Bash(git status:*)`, `Bash(git add:*)`, `Bash(git commit:*)`, `PowerShell(git commit:*)` | Bash: `git add d.txt && git commit -m compound` |
| powershell-denied | A | PowerShell: `git commit --allow-empty ...` |
| powershell-allowed | same as bash-compound | PowerShell: `git commit --allow-empty -m ps-commit` |
| powershell-readonly | A | PowerShell: `git status` |
| shell-command-bash | A | "list the files with a shell command" |
| error-max-turns | A | `/probe gamma` |
| bad-model | A | `hi` |

## Decision 1 check

Nothing contradicted Decision 1: approved settings passed via `--settings` with `--permission-mode dontAsk` work from a never-trusted folder in `-p` mode, grant exactly the listed tools, refuse the rest and write outside the project, `deny` wins, and no `--dangerously-skip-permissions` or trust writes were needed. Scope facts for later tasks: a `PowerShell` tool exists (leave it unlisted), the denial exit code is 0, and cancel needs `taskkill /T /F`.

## Rough cost

About $0.002 to $0.007 and 15 to 25 s per haiku probe, mostly startup. Plan on ~20 s per real run in any manual check.

## Skills kit: loading the `specboard` rules under the allow-list (Task 3 probes)

Probed 2026-11-08, haiku, `--permission-mode dontAsk`, allow `Read/Edit/Write(./**)`, `Bash(git status|diff|log|add|commit:*)` (and `Bash(npm test:*)`), deny `Edit/Write(./.claude/**)`. Run from Git Bash with `MSYS_NO_PATHCONV=1`, `CLAUDE*`/`ANTHROPIC*` variables unset, stdin ignored.

- A skill with `disable-model-invocation: true` DOES run when the prompt is `/cmd ARG1` in `-p` mode. `$ARGUMENTS` is substituted. The model-invocation flag only hides the skill from the model; it does not block a slash command.
- Both ways of loading the shared rules worked with no denial (`permission_denials: []`): (a) the command body says "Read `.claude/skills/specboard/SKILL.md`" and the model calls `Read` (reading `.claude/` is allowed; only writes to it are protected); (b) the body says "load the `specboard` skill with the Skill tool" and the model calls `Skill {skill:"specboard"}`, which needs no allow rule (matches Q1 above).
- Decision: every command tells Claude to Read `.claude/skills/specboard/SKILL.md` first, and to load the `specboard` skill instead if that file is missing. Read is on the allow-list and does not depend on the model choosing to call a tool that might be gated in someone's settings. No build step, no shared text copied into each command.
- **Task 4's default allow-list needs no change** for this: `Read(./**)` covers it, `Skill` stays off the list.
- End-to-end check with the real kit (`/run-spec T-001`, two subtasks, haiku, max 40 turns): ended `status: review`, two commits `T-001 · 1. ...` and `T-001 · 2. ...`, two logs with hash and files, `permission_denials: []`. `/run-spec T-002` (one unanswered question) changed nothing and refused.
- Lessons that shaped the skill wording (the first two runs stopped early with a "please allow Bash" question):
  - The model reached for `cat`/`ls` through `Bash` to read the spec; that was denied and it then gave up on all of Bash. The rules now say to read and list with Read/Glob/Grep and to use Bash only for git and the tests.
  - It chained `npm test && node -e "..."`; the compound was refused because `node` is not listed. The rules now say to run the test command alone and not to run ad-hoc scripts.
- `Glob` and `Grep` work under `dontAsk` without allow rules.
- Bookkeeping files under `.specboard/` are deliberately left out of the per-subtask commits (the commit message and log need the hash, so the log cannot be inside it); they remain uncommitted for the person to review.


## Task 4 fix-round probes: `.git`, Glob/Grep, `git -C`, and which settings a run loads

Probed 2026-11-09, Claude Code 2.1.302, `--model haiku`, `--permission-mode dontAsk`, `CLAUDE*`/`ANTHROPIC*` unset, `MSYS_NO_PATHCONV=1`, stdin ignored, temp git repos outside the Spec Board repo. Fixtures (sanitised: tool calls, denials, final text; `<ROOT>`/`<SCRATCH>` stand for temp paths) are in `packages/server/test/fixtures/claude/`. Allow base: `Read(./**)`, `Edit(./**)`, `Write(./**)` (a Write needs the Edit rule too; with only `Read`+`Write` a Write was refused) plus the named Bash prefixes.

### (a) Writes under `.git`
- Without any `.git` deny rule, a Write of `.git/hooks/x` was refused with `decision_reason_type:"mode"` (`git-hooks-no-deny.jsonl`), and an Edit of `.git/config` was refused the same way (`git-config-no-deny.jsonl`). Like `.claude/`, `.git/` is protected by default: `Write(./**)` does not grant it.
- With `deny: ["Edit(./.git/**)","Write(./.git/**)"]` the Write was refused as an explicit deny (`git-hooks-deny.jsonl`; no `permission_denied` event, only the `permission_denials` entry, as for `.claude`).
- So the `.git` deny rules are belt and braces: they keep the result from depending on the built-in default.

### (b) Glob and Grep with no allow rule
- Inside the project both ran with no rule and no denial (`grep-glob-inside.jsonl`).
- Pointed at a folder outside the project, both were refused (`grep-outside.jsonl`, `glob-outside.jsonl`, `Grep:mode` / `Glob:mode`). The bare `Glob`/`Grep` allow rules are not needed and are dropped from the default list.

### (c) `git -C . push`
- With the default allow list (no `git push`, no `Bash(git:*)`), `git -C . push origin HEAD` was refused by mode (`git-C-push-default.jsonl`).
- With `Bash(git:*)` allowed and `deny: Bash(git push:*)`, `git -C . push origin HEAD` ran (git failed only because there was no remote; `git-C-push-broad-allow.jsonl`), while plain `git push origin HEAD` was refused (`git-push-broad-allow.jsonl`, `Bash:subcommandResults`). A prefix deny does not catch `git -C . push`. Hence `isValidRule` refuses any flag as the first argument word and the whole `git` prefix is blocked by policy next to the push deny.

### (d) Which settings a headless run loads (the Decision 1 question)
Project: `.claude/settings.json` with `permissions.allow: ["Bash(touch:*)"]` and a `PreToolUse` hook that writes `hook-fired.txt`; `.claude/skills/probe/SKILL.md` (Read `notes.txt`, Write `out.txt` with `$ARGUMENTS`, run `touch proj.txt`). Run: `/probe alpha42 --settings {"permissions":{"allow":["Read(./**)","Edit(./**)","Write(./**)"]}}`. The folder was never trusted; I did not touch trust settings.

| flags added | stderr "Ignoring 1 permissions.allow entry" | project hook fired | `/probe` skill | `out.txt` = `hello alpha42` (`--settings` applied) |
|---|---|---|---|---|
| none (`sources-default`) | yes | **yes** | loaded | yes |
| `--setting-sources user` | no | no | **not loaded** (model read SKILL.md by hand) | yes |
| `--setting-sources ""` | no | no | **not loaded**; run did nothing | no |
| `--setting-sources project` | yes | yes | loaded | yes |
| `--setting-sources user,local` | no | no | ran, via the model reading the file (no project source) | yes |
| `--settings` with `"disableAllHooks":true` (`disable-hooks`) | yes | **no** | loaded | yes |
| `--setting-sources user --plugin-dir <plugin>` | no | no | loaded as `/sbplug:probe`, `$ARGUMENTS` substituted | yes |
| `--setting-sources "" --plugin-dir <plugin>` | no | no | loaded as `/sbplug:probe`, `$ARGUMENTS` substituted | yes |

Findings:
- **In an untrusted folder, `-p` mode ignores the project's `permissions.allow` but still runs the project's hooks.** A hostile repo's hook runs on every headless run unless something stops it. The "Ignoring ... permissions.allow" warning is the sign that the project source is loaded.
- Excluding the project source (`user`, `""`) removes the warning and the hook, but the project's own skills stop loading as slash commands, so `/run-spec` would not expand.
- Login worked in every variant (no auth error), including `--setting-sources ""`, so credentials are not a "setting source".
- A skill delivered as a plugin (`--plugin-dir`, folder with `.claude-plugin/plugin.json` and `skills/<name>/SKILL.md`) loads even with `--setting-sources ""`, but is namespaced `/<plugin>:<skill>`.
- Not verifiable here: whether a *trusted* folder's project `permissions.allow` would merge with `--settings`. We cannot make a folder trusted without accepting a dialog or editing `~/.claude.json`, which are off limits. Excluding the project source is what removes that risk regardless.
- The CLI also has `--restricted` (ignores user/project/local settings), but it removes Bash and the other command tools, so it cannot run specs.

Recommended run flags: `--settings <approved json> --permission-mode dontAsk --setting-sources "" --plugin-dir <spec-board plugin folder>` (skills shipped as a plugin, called `/specboard:run-spec` etc.). `--setting-sources user` also works but pulls in the person's own `~/.claude/settings.json` (their permissions and hooks), which a run should not depend on. If the plugin route is not taken and project skills stay in `.claude/skills`, the best available is `--settings` with `"disableAllHooks":true`, which stops project hooks but does NOT stop a trusted folder's project `permissions.allow` merging; report this as a concern.

## Task 5 probes: loading the rules in an isolated run

Probed 2026-11-09, Claude Code 2.1.302, `--model haiku`, spawned with `cross-spawn` from a Node script, stdin ignored, `CLAUDE*`/`ANTHROPIC*` unset, `MSYS_NO_PATHCONV=1`, temp git repos outside the Spec Board repo. Flags are the output of `buildRunArgs` (`--setting-sources "" --plugin-dir <kit> --settings {permissions, disableAllHooks:true} --permission-mode dontAsk`), plus `--model haiku` and `--max-turns` in the probe only. This replaces the Task 3 decision above ("every command tells Claude to Read `.claude/skills/specboard/SKILL.md`").

Options tried in a throwaway plugin named `specboard` (one run each; the repo also held an altered `.claude/skills/specboard/SKILL.md` with a different rule word):

| command body says | result |
|---|---|
| load `specboard:specboard` with the Skill tool | ran, right rule word, `permission_denials: []` |
| load `specboard` with the Skill tool | the model called `Skill {skill:"specboard:specboard"}`, right rule word, no denials |
| Read `${CLAUDE_PLUGIN_ROOT}/skills/specboard/SKILL.md` | the variable was substituted, but the Read was **denied** (`dontAsk`, the path is outside the project) and the run gave up |
| Read `${CLAUDE_SKILL_DIR}/../specboard/SKILL.md` | same denial |
| load `specboard:cmd-d`, a skill with `disable-model-invocation: true` | refused: `cannot be used with Skill tool due to disable-model-invocation` |
| Read `CLAUDE.md` and `.claude/settings.json` | both read with no denial, contents correct |

Decisions:

- Every command loads the `specboard` skill with the Skill tool and stops if it cannot. The altered copy in the repo was never used: an empty `--setting-sources` does not load project skills.
- A command cannot load another command (`/next` could not load `run-spec`), so the run-spec steps moved into the `specboard` skill, under "Running a spec". `run-spec` and `next` both point there.
- Every command tells Claude to Read `CLAUDE.md`, since isolated runs do not load it. `.claude/settings.json` stays readable, so taking the test command from it still works.

End-to-end with the real kit (one spec, one subtask; `package.json` with a test script; `CLAUDE.md` asking for an extra line in new text files; allow list from `defaultAllowList`). One run each:

| run | rules loaded by | result |
|---|---|---|
| isolated `/specboard:run-spec T-001` | `Skill specboard:specboard` | exit 0, `permission_denials: []`, `status: review`, `current_subtask: null`, subtask ticked, one commit, log written, `CLAUDE.md` line followed, `npm test` taken from the settings file. About $0.009 |
| isolated `/specboard:next` | `Skill specboard:specboard` | same result. About $0.010 |
| installed copies, no isolation flags, `/run-spec T-001` (stands in for typing it; `-p`, not a real interactive session) | `Skill specboard` | same result. About $0.016. stderr has the usual "Ignoring ... permissions.allow" line, as the folder is untrusted |

## Task 5: process control

- On Windows a child that Node spawned without `detached` dies when its Node parent is terminated (libuv's job object). So a test grandchild has to be detached, or killing only the parent passes too. With a detached grandchild, a plain `process.kill(pid)` fails the heartbeat test and `taskkill /T /F` through `tree-kill` passes.
- `taskkill /T` cannot reach a process whose parent has already gone. If such a process holds the output pipe, `close` lags, so a run ends 2 s after `exit` whether or not `close` has come.
- `claude auth status` prints JSON by default, with a `loggedIn` boolean, and exits 0 when logged in. The logged-out exit code was not observed (we do not log the user out); `claudeStatus` treats a non-zero exit or `loggedIn: false` as logged out.
- Through a `.cmd` shim (`@node "%~dp0echo.cjs" %*`, the form an npm-global `claude.cmd` takes, in a folder with a space in its name): the real `buildRunArgs` output reaches the child unchanged, including the empty `--setting-sources`, the prompt's apostrophe and the real quotes in the `--settings` JSON (`runs.test.ts`, stub only, not a real npm-global install). What does not survive is a cmd metacharacter inside a rule: the shim's `%*` parses the arguments a second time, past cross-spawn's escaping. So rules may not contain `& | < > ^ % " !` or a backtick, in either list.
- Child environment: `CLAUDECODE`, `CLAUDE_EFFORT`, `CLAUDE_PID`, `CLAUDE_AGENT_SDK_*` and `CLAUDE_CODE_*` are removed, except the login, provider, client-certificate and Git Bash variables listed in `status.ts`. Those names were checked against code.claude.com/docs/en/env-vars on 2026-11-09. `CLAUDE_EFFORT`, `CLAUDE_PID` and `CLAUDE_CODE_SESSION_ID` are documented there as set automatically in the subprocesses Claude Code starts.
