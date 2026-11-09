# M3 hook and settings-source probe

Captured 2026-11-09, Claude Code 2.1.302, `--model haiku`, Windows 11. Everything here comes from one script, `packages/server/test/fixtures/claude/hook-probe.cjs` (run it with `node hook-probe.cjs <work-dir> <out-dir>`; it needs a logged-in `claude`). It builds the fixture project, spawns `claude` with `cross-spawn` 7.0.6 and an argument array (no shell, stdin ignored), and writes the captures. `CLAUDE*`/`ANTHROPIC*` variables are unset and `MSYS_NO_PATHCONV=1`.

Raw captures, sanitised, in `packages/server/test/fixtures/claude/`:

- `hooks-<run>.jsonl` for runs A, B, B2, C, and `hooks-<run>-codeword.jsonl` for the CLAUDE.md check of each run. Line 1 is a `probe-meta` record (literal argv, exit code, full stderr, repo listing after the run, the `system` subtypes seen). Line 2 is the `init` event: counts for `slash_commands`, `skills` and `tools`, and the `mcp_servers` and `plugins` lists with personal names replaced. Then the tool calls, `permission_denied` events, `hook_*` events (hook name, outcome, exit code and output size only), and the result.
- `hooks-summary.json`: the script's printed summary (argv echo results, directory listings, user-hook counts, codeword replies).
- Placeholders: `<TMP>` temp folder, `<HOME>`, `<USER>`, `<ENCODED_PATH>` (a path encoded into a folder name), `<USER_PLUGIN>` (one of the person's installed plugins, or its MCP server), `<USER_MCP>` (the person's own MCP server), `<CONNECTOR>` (a claude.ai connector), `<EMPTY-STRING>` (an argument that is the empty string). Skill and slash-command names other than `probe` / `probe-plugin:probe` are reported as counts only.

## Project under test

A fresh temp git repo that was never trusted (no dialog accepted, `~/.claude.json` untouched):

- `.claude/settings.json`: `permissions.allow: ["Bash(touch:*)"]`; a `PreToolUse` hook and a `SessionStart` hook that each write a marker file (`pre-marker.txt`, `session-marker.txt`) inside the repo.
- `.claude/skills/probe/SKILL.md`: reads `notes.txt`, writes `out.txt` with `hello $ARGUMENTS`, runs `touch proj.txt`. The same file is the skill of the plugin `probe-plugin` (outside the repo).
- `CLAUDE.md`: "The project codeword is PINEAPPLE-7."
- `.mcp.json`: one server, `ghost`, with a command that does not exist.

Markers, `out.txt` and `proj.txt` are deleted before each run. Common argv: `claude -p <prompt> --model haiku --output-format stream-json --verbose --permission-mode dontAsk --max-turns 8 --settings <json> <extra>`. The `--settings` JSON is `{"permissions":{"allow":["Read(./**)","Edit(./**)","Write(./**)"]}}` except in C, where it is `{"disableAllHooks":true,"permissions":{...same...}}`.

| run | prompt | extra argv |
|---|---|---|
| A | `/probe alpha42` | none |
| B | `/probe-plugin:probe alpha42` | `--setting-sources <EMPTY-STRING> --plugin-dir <TMP>\probe-plugin` |
| B2 | `/probe alpha42` | `--setting-sources <EMPTY-STRING>` |
| C | `/probe alpha42` (settings with `disableAllHooks`) | none |

## The empty argument reaches the program

For each run the script spawned an argv-echo program through `cross-spawn` with the same argument list, once as `node echo-argv.cjs ...` and once as a `.cmd` shim (`echo-argv.cmd`, the form a `claude.cmd` install would take). Both received exactly the arguments sent (17 for B, 15 for B2, 13 for A and C), including the empty `--setting-sources` value, and the JSON `--settings` string byte for byte (`hooks-summary.json`, `shims`). The real `claude` run in B and B2 also behaved as an empty source list (below), which is the other half of the evidence.

## Results (exit code 0 for every run, including the codeword runs)

| | A | B | B2 | C |
|---|---|---|---|---|
| stderr | `Ignoring 1 permissions.allow entry from .claude/settings.json: this workspace has not been trusted. ...` (one line, full text in capture) | empty | empty | same one line as A |
| repo listing after (marker folder) | `.claude .mcp.json CLAUDE.md notes.txt out.txt pre-marker.txt session-marker.txt` | `.claude .mcp.json CLAUDE.md notes.txt out.txt` | `.claude .mcp.json CLAUDE.md notes.txt` | `.claude .mcp.json CLAUDE.md notes.txt out.txt` |
| project hooks ran (markers) | both | neither | neither | neither |
| `hook_started` / `hook_response` events | 2 started, 2 succeeded (exit 0), both `SessionStart:startup` | none | none | none |
| skill ran (`out.txt` = `hello alpha42`) | yes | yes, as `/probe-plugin:probe` | no: `/probe` was not available, the model searched for `alpha42` instead | yes |
| project `Bash(touch:*)` allow applied | no (`touch` refused) | no | not reached | no |
| `ghost` project MCP server in init | yes (status `failed`) | no | no | yes (status `failed`) |
| init counts: slash commands / skills | 119 / 80 | 56 / 20 | 55 / 19 | 119 / 80 |
| init `mcp_servers` (count) | 9: 3 `<USER_PLUGIN>` servers, 1 `<USER_MCP>`, `ghost`, 4 `<CONNECTOR>` | 4 `<CONNECTOR>` | 4 `<CONNECTOR>` | 9, same as A |
| init `plugins` (count) | 9: 6 `<USER_PLUGIN>` + 3 builtin | 4: `probe-plugin@inline` + 3 builtin | 3 builtin | 9, same as A |
| codeword reply (CLAUDE.md check) | codeword given | "None" | "None" | codeword given |

Notes on the table:

- The two `SessionStart` hooks in A: the project configures one, so the second is not from the project's `settings.json`; the event does not name its source, and the person has installed plugins, which can ship hooks. I did not verify its source. In B, B2 and C there were no hook events at all.
- The `PreToolUse` hook wrote its marker in A but produced no `hook_*` system event, so the markers are the evidence for it, not the events.
- Project `.mcp.json` servers are loaded even with `disableAllHooks` (C).
- B2 (no `--plugin-dir`) separates the flags' effects: `--setting-sources ""` alone removes the project hooks, project and user MCP servers, the person's plugins and project skills; `--plugin-dir` then adds back only the plugin's skill.

## CLAUDE.md

Prompt for the check: `State the codeword from your instructions, or say none.` (no skill). A and C gave the codeword and said it came from the project CLAUDE.md. B and B2 said none. Nothing in the `init` event lists loaded memory files: it has no `CLAUDE.md` text, and its only memory-related field is `memory_paths.auto`, the path of the auto-memory folder (recorded as `init_has_memory_paths_key`, `init_mentions_claude_md: false` in every capture). No `system` subtype in any run reports memory loading. So the conclusion "CLAUDE.md is not loaded when `--setting-sources` is empty" rests on the model not producing the codeword, over one run per configuration, not on an observable load event.

## The person's own user-level hooks

Checked by a script that reads `~/.claude/settings.json` and prints only key presence and counts: there is no `hooks` key (0 events, 0 entries). So no user-settings hooks exist in this environment, and whether an empty source list excludes them was **not tested**. What was observed is that hooks present in A (including one that is not the project's) were absent in B and B2.

## What the evidence supports

1. With default flags in an untrusted folder, project hooks run (markers and `SessionStart` events), while the project's `permissions.allow` is dropped.
2. `disableAllHooks` in `--settings` stops all hooks seen in A, but project skills, CLAUDE.md and the project `.mcp.json` server still load.
3. An empty `--setting-sources` stops the hooks, removes the person's plugins and MCP servers, the project's MCP server and project skills, and (by the codeword check) CLAUDE.md. A `--plugin-dir` skill still loads, namespaced. The claude.ai connectors were present in every run.
4. `--settings` applied in every run (the `Write` rule took effect).

## Not tested

- A trusted folder: we cannot make one without accepting the trust dialog or editing `~/.claude.json`. Whether the project's `permissions.allow` or other project settings behave differently there is unknown.
- Hooks defined in the person's own user settings (none exist here).
- Excluding the claude.ai connectors (for example with `--strict-mcp-config`).
- Repeat runs, other models, or Windows installs where `claude` is a `.cmd` file (only the argv-echo `.cmd` shim was tried).
