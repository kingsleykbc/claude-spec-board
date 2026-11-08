# Milestone 3: Claude Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pressing **Tell Claude to start** on a card makes Claude Code work through that spec in the project folder, with live output on the card, a working Stop button, and honest end states. `specboard init` sets a project up once, with an allow-list the user reviews.

**Architecture:** There are three additions.
- **A kit of Claude Code skills** (`packages/server/kit/skills/`), which `init` copies into a project's `.claude/skills/`, gives Claude the slash commands and the file-format rules.
- **A `RunManager`** in the server starts `claude -p` as a child process, turns its `stream-json` output into run lines, and classifies how the run ended from the final event plus the spec file.
- **Typed WebSocket messages and a `useRun` hook** feed the existing `RunButton`, `RunPanel` and `SpecCard` props, and replace the M2 stubs.

**Tech Stack:** Existing stack, plus `cross-spawn` (spawning `claude` / `claude.cmd` safely) and `tree-kill` (Stop). Vitest and Storybook for tests. Pin exact versions at least two weeks old.

**Spec:** [`docs/documentation.md`](../../documentation.md) §8 (commands), §9 (Run button), §10 (moving cards). Prototype: [`docs/design/Spec Board.dc.html`](../../design/Spec%20Board.dc.html) lines 584-612 (run lifecycle and toasts), 617-621 (write-up), 683-692 (end states), 751 (overview refresh). Also read [`m2-followups.md`](../m2-followups.md) and the [roadmap](2026-11-08-roadmap.md).

## Prerequisite: the user must log in first

`claude auth status` on this machine currently reports `loggedIn: false`, and `claude -p` fails with "OAuth session expired". Task 1 and the final check need a real login. **The user runs `claude` in a terminal and logs in before execution starts.** Agents must never log in, enter credentials, or touch `~/.claude.json`.

## Facts checked against the real CLI (v2.1.302, 2026-11-08)

Everything here was observed by running the CLI. Task 1 fills in what needed a login.

| Fact | Effect on the design |
|---|---|
| **A project's `permissions.allow` is ignored until the folder is trusted.** stderr: `Ignoring 1 permissions.allow entry from .claude/settings.json: this workspace has not been trusted.` | `.claude/settings.json` alone can't power a headless run. See Decision 1. |
| `--settings '<json>'` and `--allowedTools` load with no trust warning. | Run passes its approved list explicitly. |
| A `result` event can have **`subtype: "success"` together with `is_error: true`** (auth failure: `terminal_reason: "api_error"`, `result: "Failed to authenticate: OAuth session expired…"`, exit code 1). | Never trust `subtype`. Use `is_error`. |
| `result` carries `permission_denials`, `terminal_reason`, `api_error_status`, `session_id`, `total_cost_usd`. | End-state classification reads these. |
| Without stdin redirected, the CLI waits 3 s and warns `no stdin data received`. | Spawn with stdin `ignore`. |
| The stream starts with `system` events (`hook_started`, `hook_response`, `init`) from the user's own plugins. `init` lists `slash_commands`, `skills`, `permissionMode`. | The parser ignores unknown events. `init` can confirm the command exists. |
| **Project skills keep their plain name** (`.claude/skills/run-spec` → `/run-spec`). **Plugin skills are namespaced** (`--plugin-dir` → `/specboard:run-spec`). | See Decision 2. |
| `claude auth status` prints JSON with `loggedIn`, and needs no API call. `claude --version` prints the version. | Cheap pre-flight check. |
| `--permission-mode` accepts `dontAsk`; `--permission-prompts none` denies anything that would prompt. | Runs use `dontAsk`. |

## Decisions in this plan

These change or fill in the design doc. Kingsley can overrule any of them when reviewing this plan.

1. **Where a run's allow-list comes from.** The doc says `init` writes the list to `.claude/settings.json` and runs use it. That no longer works alone (first fact above). So `init` still writes it there, so that interactive Claude sessions match, **and** records the list the user approved in `~/.specboard/permissions.json`. A run passes **only that approved copy** through `--settings`, with `--permission-mode dontAsk`, so anything outside the list is refused rather than hanging.
   - **Why not read `.claude/settings.json` at run time:** that file travels with the repo. Honouring it from our flag would let a cloned repo grant itself permissions, which is exactly what Claude Code's trust check prevents. The approved copy lives outside the repo and only changes through the terminal (`init`, `allow`).
   - **Never** write `hasTrustDialogAccepted` or use `--dangerously-skip-permissions`.
2. **Skills, not an installed plugin.** `init` copies skills into the project's `.claude/skills/`. The doc (§13) leaves this open, and the roadmap said "plugin". Project skills keep the exact names in §8 (`/run-spec`, not `/specboard:run-spec`), need no marketplace, and live with the repo. A plugin wrapper can be added in M4 if it helps distribution.
3. **Permission approval stays in the terminal.** The board never approves or widens permissions. A denied run shows a ready-to-copy `specboard allow "<rule>"` command.
4. **One run per project covers every kind** (run, write-up, fix-file, refresh-overview), because they all write to the same files.
5. **Run state lives in server memory.** Files stay the only source of truth for specs. Run lines are not persisted; a page reload mid-run recovers them from the server, and a server restart loses them.

## Global Constraints

- Every M2 constraint still binds: localhost guard, JSON-only mutations, hash-checked writes, paths inside the root, Windows first.
- **A run's command line is built only from fixed strings and a validated spec ID** (`^T-\d{3,}$`). No user text reaches the prompt or the arguments, apart from the approved rules passed as JSON.
- **Spawn with an argument array, never a shell string.** Use `cross-spawn`, because `claude` may be `claude.exe` or `claude.cmd`.
- **Files stay the only source of truth for specs.** The server never parses Claude's output to decide a spec's status; it re-reads the spec.
- **Only a human moves a card to Done.** Skills must never set `status: done`.
- Runs use the user's existing login. No API keys, no `--bare`, and no `--model` flag in real runs (the user's default applies).
- Skills never `git push`, and the default allow-list never permits it.
- Normal test suites must not call the real `claude`. They use the fake CLI from Task 5. The real run is opt-in (`npm run test:claude`).

## Review Focus

1. **A hostile repo:** a project's `.claude/settings.json` or `.specboard/` contents cannot widen a run's allow-list, and a spec ID like `T-1; rm -rf` or `T-001 --dangerously-skip-permissions` gets `400` and starts nothing. Tests in Tasks 4 and 6.
2. **Stop on Windows really stops everything:** a child and its grandchild both die, a double Stop is harmless, and Stop after exit is a no-op. Closing the server kills a running child. Tests in Task 5.
3. **Output parsing survives real streams:** lines split across chunks, multi-byte characters split across chunks, malformed JSON lines, unknown event types, and `is_error: true` with `subtype: "success"`. Tests in Task 2.
4. **Every failure ends the run visibly, never a hang:** not installed, logged out, usage limit, a crash with no `result`, Claude finishing with no status change. Tests in Tasks 2 and 5.
5. **Two tabs, one run:** both press Run and the second gets `409` with the current run. A page reload mid-run shows the lines so far and continues, with no duplicates or gaps. Tests in Tasks 6 and 7.

---

### Task 1: Capture real CLI behaviour

This task is a gate. Later tasks build on what it records.

**Files:**
- Create: `packages/server/test/fixtures/claude/*.jsonl` (real captures with absolute paths and session IDs replaced by placeholders)
- Create: `docs/superpowers/m3-claude-facts.md`

- [ ] **Step 1:** Run `claude auth status`. If `loggedIn` is false, report BLOCKED and stop. Do not attempt to log in.
- [ ] **Step 2:** In a temp git repo, add a tiny skill in `.claude/skills/probe/SKILL.md` that takes `$ARGUMENTS`. Run each probe with `--model haiku --output-format stream-json --verbose --permission-mode dontAsk --settings '<json>'`, stdin ignored, keeping each prompt tiny. Capture to a fixture:
  - `ok-tools.jsonl`: `/probe` reads a file, writes a file, runs `git status`. Records `tool_use` and `tool_result` shapes, and that `$ARGUMENTS` was substituted.
  - `denied.jsonl`: asks for a command not on the list. Records the exact shape of `permission_denials`, and whether the run continues or stops afterwards.
  - `deny-rule.jsonl`: `permissions.deny` beats `allow`.
- [ ] **Step 3:** Answer in `m3-claude-facts.md`, each with the evidence:
  - Does `--settings` plus `dontAsk` allow listed tools and refuse others in an **untrusted** folder?
  - Which rule syntax scopes `Edit`/`Write` to the project (e.g. `Edit(./**)`), and is a write outside the project refused?
  - Do `Bash(git commit:*)` rules work under Windows' Git Bash? Does the model reach for a `PowerShell` tool, which would need its own rule?
  - What does the CLI do on SIGTERM / `taskkill`: does it exit, and what is the exit code?
- [ ] **Step 4:** If a fact contradicts Decision 1 (for example `--settings` doesn't work in an untrusted folder), stop and report it. Don't design around it alone.
- [ ] **Step 5:** Commit: `test(server): capture real claude stream fixtures and facts`.

---

### Task 2: Stream parsing and end-state classification

**Files:**
- Create: `packages/server/src/claude/events.ts`, `packages/server/src/claude/classify.ts`
- Test: `packages/server/test/claude-events.test.ts`, `packages/server/test/claude-classify.test.ts`

**Interfaces:**
- Consumes: the Task 1 fixtures.
- Produces:
  ```ts
  export type RunLineKind = 'start'|'read'|'edit'|'cmd'|'ok'|'done'|'stop'|'warn'|'err';   // same as the web's RunLine
  export interface RunLine { seq: number; k: RunLineKind; text: string; code?: string; time: string /* HH:mm */ }
  export class LineSplitter { push(chunk: Buffer): string[]; flush(): string[] }    // handles split lines and split UTF-8
  export interface ClaudeResult { isError: boolean; resultText: string; terminalReason: string | null; apiStatus: number | null; denials: Denial[]; sessionId: string | null }
  export interface Denial { tool: string; input: unknown }
  export function parseEvent(line: string): { lines: Omit<RunLine,'seq'|'time'>[]; result?: ClaudeResult } | null  // null = not JSON or ignorable
  export type RunKind = 'run'|'write-up'|'fix-file'|'refresh-overview';
  export type RunStatus = 'running'|'finished'|'stopped'|'needs'|'permission'|'error';
  export interface EndInfo { status: RunStatus; title?: string; text?: string; fix?: string; denied?: Denial[] }
  export function classifyEnd(input: { stopped: boolean; exitCode: number|null; result: ClaudeResult|null; stderrTail: string; kind: RunKind; before: Spec|null; after: Spec|null }): EndInfo
  export function suggestRule(d: Denial): string
  ```
- Line mapping, using the prototype's wording: `Read`/`Glob`/`Grep` → `read` "Read" + path or pattern; `Edit`/`Write` → `edit` "Editing" + path; `Bash` → `cmd` "Running" + command, or "Running tests" when the command runs a test script; a `tool_result` with `is_error` → `err`. Paths are shown relative to the project root.

- [ ] **Step 1: Write the failing tests.**
  - **Review Focus 3:** `LineSplitter` given `'{"a":1}\n{"b"'` then `':2}\n'` gives two lines; a `€` split across two chunks arrives whole. `parseEvent('not json')` and `{"type":"hook_started"}` return null without throwing.
  - **`classifyEnd` table (Review Focus 4)**, first match wins:
    - `stopped` → `stopped`
    - `result.isError` with text matching `/authenticate|logged in|\/login/i` or `apiStatus` 401 → `error`, title "Claude Code isn't logged in", text "Run `claude` in a terminal and log in, then run again."
    - `result.isError`, other → `error` with the result text
    - `result` null → `error`, "Claude Code exited with code N", with the last stderr line
    - `denials` non-empty and the spec isn't in Review → `permission` with `fix: specboard allow "<rule>"`
    - after-spec has a question unanswered that wasn't before, or still has unanswered questions and isn't in Review → `needs`
    - kind `run` and after-spec status `review` → `finished`
    - kind `run` otherwise → `error`, title "Claude stopped before finishing", text naming the subtasks left
    - other kinds with no error → `finished`
  - `suggestRule`: `Bash` `npm install date-fns` → `Bash(npm install:*)`; `Bash` `ls` → `Bash(ls:*)`; `WebFetch` → `WebFetch`.
- [ ] **Step 2:** Run `npm test -w @specboard/server`. Expected: FAIL.
- [ ] **Step 3:** Implement `events.ts` and `classify.ts`, and verify every parser assumption against the real fixtures.
- [ ] **Step 4:** Run the tests and `npx tsc -p packages/server --noEmit`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(server): parse claude stream and classify run endings`.

---

### Task 3: The skills kit

**Files:**
- Create: `packages/server/kit/skills/specboard/SKILL.md` (the shared rules) and `packages/server/kit/skills/<cmd>/SKILL.md` for `create-spec`, `update-spec`, `run-spec`, `next`, `refresh-overview`, `refresh-logs`, `correct-specs`
- Create: `packages/server/src/kit.ts`
- Test: `packages/server/test/kit.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function kitSkills(): Promise<{ name: string; text: string }[]>
  export type InstallResult = { name: string; action: 'created'|'unchanged'|'updated'|'skipped-modified' };
  export async function installSkills(root: string, opts?: { force?: boolean }): Promise<InstallResult[]>
  ```
- Content requirements:
  - **`specboard`** (model-invocable, description says when to use it) holds the file format: the layout, front matter keys, question and subtask grammar, and log format, copied from the M1 plan's "File format" section. Rules: never set `status: done`; ask through an open question and stop instead of guessing; use `Bash` for git; never `git push`; only edit `.specboard/` for spec bookkeeping, plus the code the spec needs; never edit `.claude/`.
  - Every command has `disable-model-invocation: true`, takes `$ARGUMENTS`, and starts by loading the `specboard` rules.
  - **`run-spec <id>`:**
    1. Refuse if the spec has unanswered questions or an unfinished dependency: say so and stop.
    2. Set `status: doing`.
    3. For each unticked subtask in order: set `current_subtask`, do the work, run the tests, commit with the message `<ID> · <n>. <title>`, write `logs/<n>-<slug>.md` (with `subtask`, `commit`, `files`, and a dated entry), tick the box.
    4. On a decision it can't make: add a question (`- [ ] Qk (type): text` + `  > answer:`), clear `current_subtask`, and stop.
    5. When all are ticked: clear `current_subtask`, set `status: review`, and update `updated`.
  - **`create-spec <id|idea>`:** with an existing draft ID, fills in Spec, Features, questions, subtasks, categories and urgency, and sets `draft: false`. With an idea, picks the next free ID and creates the folder.
  - **`update-spec <id> <instructions>`**, **`refresh-overview`** (rewrites `overview.md` and sets `updated`), **`refresh-logs`** (fills missing logs from git history), **`correct-specs`** (reconciles specs with the code), **`next`** (runs the most urgent unblocked To-do spec).

- [ ] **Step 1: Write the failing tests:**
  - Every skill parses with a `name` and `description`; every command skill has `disable-model-invocation: true`.
  - Grammar samples embedded in the `specboard` skill parse with core's `parseSpec` and give no `problems` (so the skill can't teach a format the board rejects).
  - `run-spec` text contains `status: review`, and no skill text contains `status: done` as an instruction or `git push` except as a prohibition.
  - `installSkills`: created on first run, unchanged on second. A file the user edited is `skipped-modified` unless `force`. Files outside `.claude/skills/<name>/` are untouched.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Write the skills and `kit.ts`. Resolve the kit folder from `import.meta.dirname`.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(server): Claude Code skills kit for spec commands`.

---

### Task 4: Setup: `init`, `allow` and the approved list

**Files:**
- Create: `packages/server/src/setup.ts`
- Modify: `packages/server/src/cli.ts` (subcommands)
- Modify: root `package.json`: add the script `"specboard": "tsx packages/server/src/cli.ts"`. Until M4 publishes a real `specboard` command, developers run `npm run specboard -- init <path>`. Messages keep saying `specboard init`, the published name.
- Test: `packages/server/test/setup.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function defaultAllowList(root: string): Promise<{ allow: string[]; deny: string[] }>
  export class ApprovedPermissions { constructor(file: string); get(pid: string): Promise<{ allow: string[]; deny: string[] } | null>; set(pid: string, p: {...}): Promise<void>; addAllow(pid: string, rule: string): Promise<void> }   // ~/.specboard/permissions.json, or under SPECBOARD_HOME
  export function mergeClaudeSettings(root: string, p: { allow: string[]; deny: string[] }): Promise<void>
  export function isValidRule(rule: string): boolean
  ```
- CLI:
  - `specboard init [path] [--yes] [--force-skills]` creates `.specboard/` (`initProject`), installs skills, prints the allow and deny lists, asks `Allow these actions for headless runs? [y/N]`, then writes both settings and the approved list and registers the project. Not a TTY and no `--yes`: refuse with a message. Answering no still sets up the project but leaves it unapproved, so Run explains how to approve.
  - `specboard allow <rule> [path]` validates and adds one rule to the approved list and to `.claude/settings.json`, after a y/N confirm.
  - `specboard [path]` still starts the board. Its "no `.specboard` folder" message now says to run `specboard init`.
- **Default list** (conservative; exact rule syntax from Task 1):
  - allow: `Read`, `Glob`, `Grep`, project-scoped `Edit` and `Write`, `Bash(git status:*)`, `Bash(git diff:*)`, `Bash(git log:*)`, `Bash(git add:*)`, `Bash(git commit:*)`, plus test commands detected from the project: `Bash(npm test:*)` and `Bash(npm run test:*)` when `package.json` has a `test` script, `Bash(pytest:*)` with `pyproject.toml` or `pytest.ini`, `Bash(cargo test:*)` with `Cargo.toml`, `Bash(go test:*)` with `go.mod`.
  - deny: `Bash(git push:*)`, `Bash(git reset:*)`, `Bash(rm -rf:*)`, writes to `.claude/**`.

- [ ] **Step 1: Write the failing tests:**
  - `mergeClaudeSettings` keeps existing keys and existing rules, adds ours without duplicates, and **refuses to overwrite** a `settings.json` that isn't valid JSON (error names the file, file unchanged).
  - `defaultAllowList` on the sample has no `git push` allow, and detects `npm test` only when the script exists.
  - `isValidRule` rejects an empty string, `*`, `Bash(*)`, `Bash`, and anything with a newline.
  - **Review Focus 1:** a project whose `.claude/settings.json` allows `Bash(*)` gets no change to its `ApprovedPermissions` entry. Approved permissions are keyed by project ID and stored outside the project.
  - `init` non-TTY without `--yes` refuses; `--yes` completes; running it twice is idempotent. `allow` adds the rule to both places.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement. All file writes are atomic. Tests use `SPECBOARD_HOME` and temp folders.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(server): specboard init and allow with an approved permission list`.

---

### Task 5: RunManager and process control

**Files:**
- Create: `packages/server/src/claude/runs.ts`, `packages/server/src/claude/status.ts`
- Create: `packages/server/test/fixtures/fake-claude.mjs`
- Test: `packages/server/test/runs.test.ts`
- Modify: `packages/server/package.json` (`cross-spawn`, `tree-kill`)

**Interfaces:**
- Consumes: `parseEvent`, `LineSplitter`, `classifyEnd` (Task 2); `ApprovedPermissions` (Task 4); core `loadProject`, `writeIfUnchanged`, `setMetaField`.
- Produces:
  ```ts
  export interface RunSnapshot { id: string; pid: string; kind: RunKind; specId: string|null; status: RunStatus; lines: RunLine[]; end: EndInfo|null; startedAt: string; dismissed: boolean }
  export type RunEvent = { type:'run-started'; run: RunSnapshot } | { type:'run-line'; runId: string; line: RunLine } | { type:'run-ended'; run: RunSnapshot };
  export class RunBusyError extends Error { run: RunSnapshot }
  export class NotApprovedError extends Error {}
  export class ClaudeUnavailableError extends Error { reason: 'not-installed'|'logged-out' }
  export class RunManager {
    constructor(opts: { approved: ApprovedPermissions; emit: (pid: string, e: RunEvent) => void; command?: (args: string[]) => { bin: string; args: string[] }; status?: () => Promise<ClaudeStatus> });
    start(entry: ProjectEntry, kind: RunKind, specId: string|null): Promise<RunSnapshot>;
    stop(pid: string, runId: string): Promise<void>;
    current(pid: string): RunSnapshot|null;
    dismiss(pid: string, runId: string): void;
    projectChanged(entry: ProjectEntry): Promise<void>;
    close(): Promise<void>;
  }
  export interface ClaudeStatus { installed: boolean; loggedIn: boolean; version: string|null }
  export function claudeStatus(): Promise<ClaudeStatus>   // `claude --version`, `claude auth status`; cached 30 s; never throws
  ```
- Prompts, fixed by kind: `run` → `/run-spec <id>`; `write-up` → `/create-spec <id>`; `fix-file` → `/update-spec <id> Fix this file's formatting problems. Keep all content.`; `refresh-overview` → `/refresh-overview`.
- Command: `claude -p <prompt> --output-format stream-json --verbose --permission-mode dontAsk --settings <json of approved {permissions}>`, with cwd = project root and stdin `ignore`.
- Behaviour:
  - First line: `start` "Started on <ID> · <title>".
  - `projectChanged` reloads the running spec and, for each newly ticked subtask, adds a `done` line, "Subtask N done: <title> · committed", with the commit from its log.
  - Lines are capped at 2000 (oldest dropped, `seq` keeps counting).
  - On exit: classify; add a final line (`done`/`warn`/`err`/`stop`, per the prototype's `finishRun` wording); clear a leftover `current_subtask` through `writeIfUnchanged` (retry on conflict, and give up quietly after 3 tries).
  - The last run per project stays until dismissed or replaced.

- [ ] **Step 1: Write the failing tests,** using `fake-claude.mjs` (spawned through `process.execPath`), which replays a fixture and applies a named scenario to the temp project's files:
  - Success: status `running` → `finished`, spec in Review, lines in order with increasing `seq`, and the command line contains no `--dangerously-skip-permissions`.
  - The arguments contain the **approved** rules, not the rules in the project's `.claude/settings.json` (**Review Focus 1**).
  - A second `start` while running throws `RunBusyError` (**Review Focus 5**). A start on another project works.
  - No approved list → `NotApprovedError`. `status()` not installed or logged out → `ClaudeUnavailableError`, with nothing spawned.
  - **Review Focus 2:** the fake spawns a grandchild that writes a heartbeat file. `stop` ends both (the heartbeat stops changing), status `stopped`. A double `stop` is harmless, `stop` after exit is a no-op, and `close()` kills a running child.
  - **Review Focus 4:** a crash with no `result` gives `error` with the exit code; spawn failure (`ENOENT`) gives `error`, not an unhandled exception; a hung-then-stopped child still ends.
  - `projectChanged` adds exactly one `done` line per newly ticked subtask. A leftover `current_subtask` is cleared after the run.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement. `stop` uses `tree-kill`: `SIGTERM`, then `SIGKILL` after 3 s if still alive (on Windows `tree-kill` uses `taskkill /T /F`).
- [ ] **Step 4:** Run the tests (they must exit on their own, with no leftover processes) and `tsc`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(server): RunManager with stream parsing and tree stop`.

---

### Task 6: Run routes and typed WebSocket messages

**Files:**
- Create: `packages/server/src/routes/runs.ts`
- Delete: `packages/server/src/routes/claude.ts`
- Modify: `packages/server/src/hub.ts`, `src/app.ts`, `src/start.ts`, `src/http.ts`, `src/watch.ts`
- Test: `packages/server/test/runs-routes.test.ts`; update `realtime.test.ts`, `e2e.test.ts`, and any test of the stubs

**Interfaces:**
- Consumes: `RunManager`, `claudeStatus`.
- Produces:
  - `POST /api/projects/:pid/runs` with `{ kind, specId? }` → `202 { run }`. Errors: `409 { error, run }` busy; `412 { error, setup: 'not-approved', command: 'specboard init' }`; `503 { error, claude: 'not-installed'|'logged-out' }`; `400` for a bad kind or a spec ID not matching `^T-\d{3,}$`; `404` unknown spec.
  - `POST /api/projects/:pid/runs/:runId/stop` → `202`. `POST …/runs/:runId/dismiss` → `204`.
  - `GET /api/projects/:pid/run` → `{ run: RunSnapshot|null, claude: ClaudeStatus, approved: boolean }`.
  - `Hub.send(pid, msg)` replaces `broadcast`, sending `project-changed` and `RunEvent` messages.
  - The `ClaudeBridge` placeholder in `AppDeps` is replaced by `runs: RunManager`.
  - The watcher's change callback also calls `runs.projectChanged(entry)`.
  - Malformed front matter on a spec edit gives `422 { error }` instead of 500 (`No front matter`, `Front matter is not valid YAML`).
  - Watcher errors are logged to stderr.

- [ ] **Step 1: Write the failing tests:**
  - **Review Focus 1:** `specId` of `T-1; rm -rf`, `T-001 --help`, `../T-001`, and a non-string all give `400`, with `start` never called.
  - **Review Focus 5:** two concurrent POSTs give one `202` and one `409` carrying the current run.
  - Each error mapping above. `GET run` shape. A cross-origin POST still gets `403` and `text/plain` still `415`.
  - Real `ws` client through `start()`: events arrive in order for the subscribed project only.
  - A spec with broken YAML: `PATCH meta` gives `422`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement. `start()` builds one `RunManager`, and `close()` closes it before the server.
- [ ] **Step 4:** Run `npm test -w @specboard/server` and `tsc`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(server): run endpoints and typed websocket events`.

---

### Task 7: Web data layer for runs

**Files:**
- Create: `packages/web/src/state/useRun.ts`
- Modify: `packages/web/src/api/client.ts`, `src/api/live.ts`, `src/state/useProject.ts`
- Test: `src/state/useRun.test.ts`, updates to `live.test.ts`, `useProject` tests

**Interfaces:**
- Consumes: Task 6's endpoints and events.
- Produces:
  ```ts
  export interface UseRun { run: RunSnapshot|null; claude: ClaudeStatus|null; approved: boolean; start(kind: RunKind, specId?: string): Promise<StartResult>; stop(): Promise<void>; dismiss(): Promise<void> }
  export type StartResult = { ok: true } | { ok: false; reason: 'busy'|'not-approved'|'logged-out'|'not-installed'|'offline'|'error'; message: string; run?: RunSnapshot };
  export function useRun(pid: string, live: LiveChannel): UseRun
  ```
  - `connectLive` gains an `onMessage(msg)` callback for non-`project-changed` messages, and calls `onChange` on the first open too (M2 follow-up).
  - Remove `api.claude`. Add `startRun`, `stopRun`, `dismissRun`, `getRun`.
  - `useProject` gains `applyWrite(spec)`, which puts a returned spec into the snapshot straight away, closing the stale-hash window from the M2 follow-ups. Use it for every spec write.

- [ ] **Step 1: Write the failing tests:**
  - **Review Focus 5:** a snapshot with lines to seq 5, then events 4, 5, 6: no duplicates, in order. A gap in `seq` (a missed event) triggers a re-fetch. A reconnect re-fetches. Switching project resets state.
  - `start` maps each server error to its `reason`. While disconnected it returns `offline` with no request.
  - `applyWrite` replaces only that spec and doesn't mark it as live-changed.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test -w @specboard/web` and `tsc`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(web): useRun hook and typed live messages`.

---

### Task 8: Wire the board to real runs

**Files:**
- Modify: `packages/web/src/App.tsx`, `state/actions.ts`, `components/detail/CardDetail.tsx`, `detail/RunPanel.tsx`, `detail/RunButton.tsx`, `components/SpecCard.tsx` usage, `components/Board.tsx`, `components/OverviewModal.tsx`, `components/AddSpecModal.tsx`, stories and tests

**Interfaces:**
- Consumes: `useRun`.
- Produces the prototype's run lifecycle (lines 584-612, 617-621, 751):
  - **RunButton state:** `running` if this spec is running; `disabled` with `runningId` if another spec is; `fallback` if `claude.installed` is false; otherwise `ready`.
  - **Board card:** `running` is the current subtask's title while this spec's run is active. `writing` is true during a `write-up` run. `runActive` feeds Subtasks.
  - **RunPanel:** shown as CardDetail's `aside` when `run.specId` is this spec and it isn't dismissed. It takes `end` from the server, so `END` becomes the fallback copy, and `PERMISSION_RULE` is replaced by `end.fix`. The note reads "Run this in a terminal, then run again." Actions: Go to question scrolls, Copy rule copies `end.fix`, Run again starts a new run. Dismiss calls the server.
  - **Toasts, on run events:** `Claude started on <ID>`, `<ID> · Subtask done`, `<ID> moved to Review`, `Stopped Claude on <ID>` / "Work so far is committed.", `Claude needs your answer on <ID>`, `Claude stopped on <ID>`, `Run failed on <ID>`. Fire once per event, not on reconnect replays.
  - **"Have Claude write this up":** `start('write-up', id)` and toast `Claude is writing up <ID>`. Add spec's second button does the same after creating.
  - **"Ask Claude to fix":** `start('fix-file', id)` and toast `Asked Claude to fix <ID>`.
  - **Overview Refresh:** `start('refresh-overview')`. Shows "Refreshing" and "Claude is rewriting the summary…" while it runs, then toast `Overview updated`.
  - **Refusals:** `not-approved` → err toast "This project isn't set up for runs" / "Run `specboard init` in a terminal." `logged-out` → "Claude Code isn't logged in" / "Run `claude` in a terminal and log in." `busy` → "Claude is already working on <ID>". `offline` → the existing offline toast.
  - Delete `askClaude`'s stub path and `CLAUDE_STUB_TOAST`.
- Editing a spec during a run stays protected by the M2 conflict handling. Do not change it.

- [ ] **Step 1: Write the failing tests:**
  - Each RunButton state from a `useRun` value, including `disabled` for a different spec.
  - Panel shows while running and after ending, and Dismiss hides it. A `permission` end shows `end.fix` and Copy rule copies it. Run again calls `start`.
  - Each toast fires exactly once when its event arrives, and none fire when a snapshot is replayed after a reconnect.
  - Each refusal reason shows its toast. Write-up, fix-file and refresh call `start` with the right kind.
  - No reference to `CLAUDE_STUB_TOAST` or `api.claude` remains.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement. Update the stories: RunPanel with server-provided `end`, the Overview refreshing state, card writing state.
- [ ] **Step 4:** Run `npm test -w @specboard/web`, `npm run test:stories -w @specboard/web`, and `tsc`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(web): wire Run, Stop, write-up, fix and refresh to real runs`.

---

### Task 9: Real run check and docs

**Files:**
- Create: `packages/server/test/real-claude.test.ts`, run only by a new root script `test:claude` (excluded from `npm test`)
- Create: `docs/superpowers/m3-manual-check.md`, `docs/superpowers/m3-followups.md`
- Modify: `docs/documentation.md` §8, §9, §13 and `docs/superpowers/plans/2026-11-08-roadmap.md` so they describe Decisions 1 and 2

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: The real test.** It needs a login, and it skips with a clear message if `claude auth status` says otherwise. In a temp git repo with a tiny fixture project (one spec with two trivial subtasks, such as creating two small text files) and `SPECBOARD_HOME` pointing at a temp folder: `init --yes`, start a real run through `RunManager`, and assert:
  - status `finished`, spec in Review, both boxes ticked, two log files with commits, two new git commits with the agreed message format
  - no `status: done`, no push, `.claude/` unchanged
  - then a second spec that needs a decision: end state `needs`, with a parseable new question
  - then a spec whose work needs a disallowed command: end state `permission`, with a usable `end.fix`
- [ ] **Step 2:** Run `npm run test:claude`. Expected: PASS. Say in the report roughly how much it used. If a skill misbehaves, fix the skill text and re-run.
- [ ] **Step 3: Manual check in the built-in browser,** on a temp copy of `examples/recipe-box` with `SPECBOARD_HOME` pointing at a temp folder, after `init --yes`. Record pass or fail with a note for each in `m3-manual-check.md`:
  - Run a small spec: live lines, subtask ticks flash, card moves to Review, toast.
  - Stop mid-run: process tree gone (check the process list), panel shows Stopped, Run again continues.
  - Answer a question Claude asked, then Run again: it picks the answer up.
  - A denied command shows the rule; `specboard allow` plus Run again gets past it.
  - Reload the page mid-run: lines recover. A second tab shows the run and can't start another.
  - "Have Claude write this up", "Ask Claude to fix", and Overview Refresh each work.
  - Log out state: temporarily point `RunManager` status at a stub or use a fixture, and confirm the message. Do not actually log the user out.
  - Edit a spec during a run: no silent overwrite.
- [ ] **Step 4:** Update the docs, and write `m3-followups.md` from the deferred review items. If today is on or after 2026-11-16, also bump `@hono/node-server` to 1.19.18 or later.
- [ ] **Step 5:** Run root `npm test`, `npm run test:stories -w @specboard/web`, and `tsc` for all three packages. Expected: PASS.
- [ ] **Step 6:** Commit: `feat: real Claude run check, M3 manual check and docs`.

---

## Done when
- `specboard init` then `npm run board` on a real project lets the user press Run and watch Claude finish a spec, ending in Review with a log and a commit per subtask.
- Stop kills the whole process tree on Windows.
- Every failure in Review Focus 4 shows a clear end state.
- No stub remains, normal suites never call the real `claude`, and `npm run test:claude` passes.
