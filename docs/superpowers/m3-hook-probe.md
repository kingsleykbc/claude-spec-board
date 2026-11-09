# M3 hook and settings-source probe

Captured 2026-11-09, Claude Code 2.1.302, `--model haiku`, Windows 11. Run from a Node script that spawns `claude` with `cross-spawn` 7.0.6 and an argument array (`shell` off, stdin ignored), the same path the run manager will use. `CLAUDE*`/`ANTHROPIC*` variables unset, `MSYS_NO_PATHCONV=1`. Personal names and paths are replaced with `<HOME>`, `<USER>`, `<SCRATCH>`. Earlier single-run evidence is in `m3-claude-facts.md` (fix-round probes); this file adds marker-file evidence for hooks.

## Project under test

A fresh temp git repo outside Spec Board, never trusted (no dialog accepted, `~/.claude.json` untouched). Contents:

- `.claude/settings.json`: `permissions.allow: ["Bash(touch:*)"]`; a `PreToolUse` hook (`node -e "require('fs').writeFileSync('pre-marker.txt','1')"`); a `SessionStart` hook writing `session-marker.txt` the same way. Both markers are written inside the repo.
- `.claude/skills/probe/SKILL.md`: reads `notes.txt`, writes `out.txt` with `hello $ARGUMENTS`, runs `touch proj.txt`. The same file is the skill of the plugin `probe-plugin` (`.claude-plugin/plugin.json`, `skills/probe/SKILL.md`), kept outside the repo.
- `CLAUDE.md`: "End every reply with the exact line CODEWORD-PINEAPPLE-7."
- `.mcp.json`: one server, `ghost`, with a command that does not exist.

Markers, `out.txt` and `proj.txt` were deleted before each run. Common argv (after the run-specific part): `-p <prompt> --model haiku --output-format stream-json --verbose --permission-mode dontAsk --max-turns 8 --settings <json>`. `<allow>` below is `["Read(./**)","Edit(./**)","Write(./**)"]`.

## Results

| | A: default flags | B: no setting sources + plugin | C: hooks disabled |
|---|---|---|---|
| prompt | `/probe alpha42` | `/probe-plugin:probe alpha42` | `/probe alpha42` |
| `--settings` | `{"permissions":{"allow":<allow>}}` | same as A | `{"disableAllHooks":true,"permissions":{"allow":<allow>}}` |
| extra argv | none | `--setting-sources ""` (one empty-string argument) `--plugin-dir <SCRATCH>/m3-task4/probe-plugin` | none |
| exit code | 0 | 0 | 0 |
| stderr, first line | `Ignoring 1 permissions.allow entry from .claude/settings.json: this workspace has not been trusted. ...` | empty | same warning as A |
| `pre-marker.txt` exists | **yes** | no | no |
| `session-marker.txt` exists | **yes** | no | no |
| skill ran, `out.txt` = `hello alpha42` | yes | yes | yes |
| `touch proj.txt` (project `Bash(touch:*)` allow) | refused (Bash denial), file absent | refused, file absent | refused, file absent |
| `CLAUDE.md` honoured (codeword in reply) | yes | **no** | yes |
| init `slash_commands` has | `probe`, plugin and user skills, built-ins | `probe-plugin:probe`, built-ins only | same as A |
| init `mcp_servers` | user and plugin servers, **`ghost` (source project, status failed)**, claude.ai connectors | **claude.ai connectors only** | same as A, `ghost` included |
| init `plugins` | the person's installed plugins (telegram, frontend-design, superpowers, code-review, render, mongodb) plus three builtin | `probe-plugin@inline` plus the three builtin; none of the person's | same as A |

Notes:
- The empty-string `--setting-sources ""` survived `cross-spawn` as an empty argument: in B the person's own plugins, user MCP server and project MCP server are all absent, which only happens when the source list is empty. (The argv row prints the empty argument as `""` for readability.)
- Login worked in all three runs.
- In A and C the warning shows the project settings file is read in an untrusted folder, and its `permissions.allow` entry is dropped (the `touch` was refused).

## What the evidence shows

1. In an untrusted folder, a headless run with the default flags ran the project's `PreToolUse` and `SessionStart` hooks. Project hooks are not covered by the "Ignoring ... permissions.allow" behaviour.
2. `--settings '{"disableAllHooks":true,...}'` stopped both hooks. Everything else from the project still loaded: skills, `CLAUDE.md`, and the project `.mcp.json` server (`ghost` was started and failed).
3. `--setting-sources "" --plugin-dir <plugin>` stopped both hooks and removed the person's plugins, the user MCP server, the project MCP server and the project's skills. It kept the plugin's skill (namespaced), `--settings`, and login. It also dropped `CLAUDE.md`, so a run in this mode gets project conventions only if the skill or prompt carries them. The claude.ai connectors (Docs, Twilio, Calendar, Gmail) were still present in every run.
4. `--settings` still applied in every run (the Write rule in the allow list took effect).

## Not tested

- A trusted folder. We cannot make one without accepting the trust dialog or editing `~/.claude.json`, so whether the project's `permissions.allow` merges with `--settings` there, and whether anything else changes (for example hook prompts), is unknown.
- Whether the claude.ai connectors can be excluded (for example with `--strict-mcp-config`).
- More than one run per mode, and models other than haiku.
