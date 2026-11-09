# Milestone 3: deferred follow-ups

These items came up in the M3 reviews and the real-run check, and were deliberately left out of M3. Read this list when planning M4. The final review should triage the "Permissions" group first.

## Do soon (open from M2)
- **Re-bump `@hono/node-server` to 1.19.18 or later** on or after 2026-11-16. One moderate advisory remains in `serveStatic`, which the server does not use. Not bumped in M3: Task 9 ran on 2026-11-09, inside the two-week rule.
- **CI must build the web app before `npm test`.** Otherwise the e2e `GET /` test is skipped without notice.

## Everything else from `m2-followups.md`, checked against the code on 2026-11-09

Done in M3:
- Typed WebSocket messages: `Hub.send(pid, msg)`, with `project-changed`, `run-started`, `run-line`, `run-ended`.
- One `useRun` hook feeding RunPanel and RunButton.
- Project-scoped run routes, in the shape `POST /api/projects/:pid/runs` and `/runs/:runId/stop`. `ClaudeBridge` is gone.
- Applying writes locally (`applyWrite`), and the first WebSocket open now does a plain load.
- A failed refresh after a move no longer depends on the refresh: the write's returned spec is applied first. Read from the code, not re-run in a browser.
- Logging watcher errors (`watch.ts`).
- Malformed front matter now returns 422 (`http.ts`).

Still open:
- **Watcher and sockets:** no ping/pong liveness check.
- **Packaging:** ship a prebuilt `dist`; `npm run board` still builds on every launch.
- **Server and CLI:** the registry name is frozen at add time. A deleted project folder still shows as `0/0`. The "already running" check ignores `SPECBOARD_HOME`. Signal handlers are installed only after startup.
- **References:** link de-duplication and DELETE are case-sensitive on Windows. A config entry that points outside the root can't be unlinked. A dangling symlink at a draft path can escape the project. `Remove` has no double-click guard. Tab arrows aren't rechecked when the modal is resized.
- **Questions:** saving clears every New badge, including on unanswered questions. Number answers are not validated (`0`, `-5`). Questions of new specs that are already answered still show New.
- **Board:** a pointer drag can start from the inner buttons. Category suggestions and the status menu have no arrow-key navigation.
- **Markdown:** unsafe URLs leave anchors with an empty `href`. `####` headings are not shifted. Linked images produce nested `<a>` elements.
- **Accessibility:** the card's aria-label hides its blocked and review state. Tooltips work with the mouse only.
- **Tests:** the e2e test counts events absolutely instead of against a baseline (the file changed in M3, so recheck). Several races are untested: revert, draft survival, forced conflicts. Tests for the OPTIONS and HEAD guards are missing, and the static-file guard has one traversal test.

These were checked by reading the code and by whether M3 touched the files; none was re-run.

## New from the real-run check (Task 9)
- **Remove the pre-publish wording in M4.** `packages/web/src/lib/prePublish.ts` holds the "Until Spec Board is published" text for the panel and the toast, and `packages/server/src/prePublish.ts` holds it for CLI output (`start.ts`, `setup.ts`, including the `npm run board` line `init` ends with). Delete both once `specboard` is on the PATH, along with the matching sentence in `documentation.md` section 9 and its "Try it" section's commands. `NotApprovedError` (only the web's toast wording reaches the person) and `end.fix` already say `specboard ...`, and become correct then.
- **Still to do by hand: a real typed `allow` in a terminal and a forced edit conflict during a real run.** The manual check marks both PARTIAL.
- The hostile test's MCP marker has no positive control: the marker command is proven to work, but nothing shows the `ghost` server would start and write it outside an isolated run. (`m3-hook-probe.md` shows project MCP servers load by default, with a server that doesn't exist.)
- Rule 3's "ad-hoc scripts" is ambiguous now that a command the spec names may be tried: a spec could name a script. The permission list still decides.
- Typing `/run-spec` in a real interactive session has not been checked (only `-p` stood in for it). A real npm-global `claude.cmd` has not been checked either (only a stub shim, and the machine's `claude.exe`).
- Whether a permission end happens depends on the model trying the command. Before the rule 3 fix it sometimes declined and asked instead (a run on the hostile project did this once). Two later runs and the manual check all tried it, but it remains a model behaviour, so `test:claude` can occasionally fail on it.
- Stopping between a subtask's commit and its tick leaves a commit with no tick. Run again recorded the commit and did not redo the work, once. The skill doesn't spell out this case; it relies on the model's judgement.
- The Overview shows "Last updated 4h ago" right after a refresh, because `updated` is a bare date counted from the start of the day. Show the date instead, or "today".
- `GET /api/projects/:pid/run` returns the previous run while a new one is being prepared (a few seconds for the status check). Harmless on the page today; a script polling it can misread it.
- `childEnv` keeps `ANTHROPIC_*`, so a board started inside a Claude Code desktop session inherits that session's `ANTHROPIC_BASE_URL`. The real checks removed those variables. Starting from a plain terminal is unaffected. Decide whether to drop that one variable when the session markers are present.
- claude.ai connectors stay listed in isolated runs. They aren't on the allow-list; whether a call to one is refused has not been tested.
- Claude adds a `Co-Authored-By` line to run commits. Decide whether the skill should say anything about it.
- `npm run test:claude` costs about $1.10 to $1.25 by the CLI's own figure on the default model, and takes about 5 minutes. A cheaper fixture would help if it is run often.

## Permissions and rule checks
- **Task 4 M2 and M3, flagged for final review:** the deny floor is checked per entry, so a hand-edited `Bash(*)` in `permissions.json` needs a closer look.
- `matchesDeny` misses path variants like `Write(.claude/**)` (the runtime deny still wins). It treats narrower paths as non-overlap (`Write(./.git/hooks/x)`): the runtime deny should win, but that combination is unprobed.
- A wildcard inside the program word (`g*t push`) isn't caught in deny. First-word normalisation also applies to non-shell specs (safe direction).
- Launchers (`npm exec`, `pnpm dlx` and similar) were noted as still getting a prefix rule; recheck, since `start` and `call` have since joined `NEVER_PREFIX`. Typed `Bash(find/awk/npm:*)` still pass the gate (a human's call), though the board no longer offers `find` or `awk`. Non-shell tools accept any capitalised word (`Foo`). Bare `Glob` is still accepted by `allow`.
- A hyphenated MCP tool name gives a null rule and falsely says "blocked by this project's rules". The offered rule for a compound command is a guess at the denied segment.
- Tool sets are repeated from `classify.ts`.
- `mergeClaudeSettings` always rewrites; a BOM gives a misleading error. A malformed `permissions.json` is checked late. A stale allow during the prompt. No cross-process lock (accepted). Rules removed by deny vanish silently and the refusal text is inexact. `set`/`addAllow` store rules untrimmed. The `assertNoLinks` check has a TOCTOU window (accepted).
- "Dropping earlier rule" prints before the prompt. A dropped rule stays in `.claude/settings.json`. Skills install before the `.specboard` link check.
- `init` silently loses a hand-added deny rule that fails the check (a notice is logged).
- `assertNoLinks` can refuse with a misleading message if an existing folder differs only by case (`.Claude`). Hard links are undetected. The `SKILL.md` symlink test silently skips when the OS refuses to create one, and another symlink test has a silent return.

## Skills and kit
- `git diff --name-only HEAD~1 HEAD` fails on a repo's first commit.
- A subtask title with `"` or `$` breaks the quoted commit message.
- The `updated` date taken from context can be wrong.
- The log sample is tested by regex, not `parseLog`. The allow-list guard test misses unquoted commands in code fences.
- A kit upgrade shows old installs as skipped-modified until `--force-skills`.
- "The entry that runs the tests" relies on model judgement. It worked in the real runs that had none listed; a project with a real test command wasn't in the real test (the Task 5 probe covered one).

## Run manager and status
- The `flush` at the top of `finish` is outside the `try` (unreachable today).
- Non-Windows: `SIGKILL` is skipped once the parent exits. After the 8 s stop timeout the project is freed while the child may live.
- Retrying a conflict in `clearCurrentSubtask` is untested, and there's no shared `withRetry`. Pre-ticked and untick/retick subtasks have no tests.
- An auth-status timeout reads as logged out and is cached for 30 s.
- `fix-file` on broken YAML gives "Started on T-001 · " with an empty title.
- Network variables (`CLAUDE_CODE_CERT_STORE`, `CLAUDE_CODE_PROXY_RESOLVES_HOSTS` and similar) are stripped from the child environment, so proxy users may fail.
- The no-result stderr auth check `/\/login/` can match `src/login.ts` in a crash trace. A second-byte split of a 3-byte character is untested. `MultiEdit` and `NotebookEdit` produce no run line.

## Routes and sockets
- A spec vanishing between the route check and start gives a 500 (message mismatch on "was not found"). `fix-file` on unparseable front matter gives 404 (consistent: those specs have no card).
- Dismissing a running run is a silent 204. A close-time `run-ended` may not arrive.
- Raw stderr and result text reach clients through `end.text` (localhost only: final review).
- The 4 MB `bufferedAmount` cutoff is untested.

## Web
- `useRun` and `applyWrite` briefly hold the previous project's data before the effect commits (`App` keys by pid, so harmless). Out-of-order fetches could clear a newer adopted run. A first open after failed attempts highlights.
- A project switch mid-run drops the old run's end toast. An in-flight start refusal can toast after a switch. The double-click guard silently skips the write-up in `AddSpecModal`. No test of the refresh end toast with the modal closed. A run ended while offline shows no toast (by design).
- The toast sub-line is missing if the held spec lacks that subtask number.

## Facts doc
- `Skill` tool_use in "Names seen" has no fixture. A doubled `<` in the powershell-denied sanitiser. Windows path-matching coverage is thin. The Q4 observations have no repro script. The `recommended` row describes rules in words, not JSON. The powershell-readonly wording "told to use it" isn't visible in the fixture.

## From the final review, left for later
- Whether `--setting-sources ""` drops a person's `model` setting. Not verified; `documentation.md` section 9 says so too.
- Whether a claude.ai connector call is refused in a run. Try `--strict-mcp-config`.
- No named test or fixture for a usage limit: it goes down the generic `isError` path.
- `HEAD~1` on a first commit, and subtask titles with `"` or `$` in commit messages: probe a `$(...)` title.
- **Before the M4 publish: clean the personal handle from git history.** It was removed from `m3-claude-facts.md` in the working tree only. Rewriting history is the owner's decision.
- From Task 9, not verified: a real interactive `/run-spec`, a real npm `claude.cmd` (now also started by absolute path through `cmd.exe`), the logged-out skip path, connectors, an already-trusted folder.
- `init` warns about a missing `.git` at the folder itself, so a project in a subfolder of a repo gets the warning too (its wording allows for that).
- A refresh's permission rule shows only in its toast, for 4.5 s. The Overview modal could keep it on screen.

## Open after the status and child PATH hardening
- The admin-share spelling `\\localhost\C$\...` of a project folder is not recognised as that folder, by the lookup, the child PATH or the home-inside-root check. The system's real path keeps it as a network path.
- A file symlink in a PATH folder outside the project, pointing to a program inside it, is still picked: only the folder is checked, not the file found in it.
- `setup.ts:343` refuses a project that holds the kit, so in M4 a project that installs Spec Board as a local dependency can't be set up. Decide before publishing.
- The toast for a refused refresh shows the rule without `allowHint`, so it lacks the "run this from the Spec Board repo" wording the Run panel has.

- `init`'s `SPECBOARD_HOME` suggestion can lead a person to a home whose folder becomes a project root holding `claude`, `node` or `git`, which then drop out of PATH. Warn at `init`.
- A corrupt `projects.json` is replaced on the next `start` (a `.bak` is kept), which drops the exclusion of every old project. Log it or refuse.
- The unreadable-registry message rarely reaches the page: with a corrupt file the run routes answer 404 before `start`, and the status path only logs it.
- PATH resolution isn't memoized: every status check and run does real-path lookups for each entry, synchronously, and an offline `\\nas\...` entry blocks the event loop while it times out. Memoize it.

## Closed by Task 9
- Streamed `run-line` carries `subtask`: confirmed in the real test (`[1, 2]`) and on the page.
- `env`/`apiKeyHelper` wording: now in `documentation.md` section 9, confirmed by a probe.
- A tick and log after the commit leaves bookkeeping uncommitted (ruling R8): confirmed and documented.

## Process only
- Task 2's tests were written after its implementation.
- Task 7 noted that Task 8 must restore the Refreshing story and start-error tests. Check this at final review.

## Test stability
- Several server tests (`cli.test.ts` start, `e2e.test.ts`, `realtime.test.ts`) hit vitest's 5 s limit when `npm test` runs alongside other heavy work. They pass when run alone. CI on M4 may need longer timeouts.
- `setup.test.ts` failed once with no captured reason and hasn't recurred; both spawning tests now have 60 s timeouts.
