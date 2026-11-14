# Plugin, milestones, table view and sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Spec Board as an installable Claude Code plugin, add optional milestones, a table view, a manual-mode notice, a richer Overview, Sync with code, PR links and token counts in logs, and small-screen support.

**Architecture:** Core gains milestone/PR parsing and a shared tree renderer. The kit skills move to `plugin/` (the one source for `specboard init`, `--plugin-dir` runs and the marketplace plugin), and a bundled `plugin/bin/specboard.mjs` plus `plugin/web/` lets the plugin run the board with no npm step. The server parses token usage and adds two project-level run kinds for sync. The web adds a view switch, milestone dropdown, table, manual notice, sync dialog and responsive CSS.

**Tech Stack:** TypeScript, npm workspaces, Hono, React 19, Vite, vitest (happy-dom), Storybook, esbuild (bundle).

**Spec:** `docs/superpowers/specs/2026-11-14-plugin-milestones-views-design.md`

## Global Constraints

- Windows 11, Node 22, existing workspaces. Only new dependency: `esbuild` as an exact-pinned root devDependency, at the version already in `node_modules` via Vite.
- Old projects (no milestones, no `pr:`, no plugin) keep working unchanged. All existing tests and stories keep passing.
- The top grouping is called **milestone** everywhere (UI, files, skills, docs). Never "phase".
- Plugin name `specboard`; marketplace name `spec-board`; install text: `/plugin marketplace add kingsleykbc/claude-spec-board` then `/plugin install specboard@spec-board`.
- Never write `done` from Claude/sync; sync never deletes spec files (archive only).
- Skills stay short and plain Markdown; every command skill loads the `specboard` skill first, as today.
- Commit messages: plain, **no `Co-Authored-By` trailer**.
- Icons only from `packages/web/src/lib/icons.ts` (Lucide via react-icons). Colours only from the CSS tokens.

## Review Focus

1. A spec whose `milestone:` is not in the config list (typo, different case) → shows under "No milestone" and the card gets a file problem; nothing crashes. (Task 1 test.)
2. A project with no `milestones:` list but specs that carry `milestone:` → treated as a project without milestones; no problem, no dropdown. (Task 1 test.)
3. A sync proposal file with broken or missing front matter → dialog still shows the body and offers Discard; Confirm is disabled. (Task 10 test.)
4. A result event with no `usage` (older Claude Code, or a stopped run) → no token text anywhere, no crash. (Task 6 test.)
5. Table view with zero specs, or a milestone with zero specs → a short empty message instead of an empty table. (Task 8 test.)

---

### Task 1: Core — milestones and PR links

**Files:**
- Modify: `packages/core/src/types.ts` (SpecMeta), `packages/core/src/frontmatter.ts` (defaultMeta + parse), `packages/core/src/parseOther.ts` (ProjectConfig, SubtaskLog, parseConfig, parseLog), `packages/core/src/project.ts` (unknown-milestone problem)
- Create: `packages/core/src/milestones.ts`, export from `index.ts`, and add `"./milestones": "./src/milestones.ts"` to core `package.json` exports (browser-safe, like `./you`)
- Test: `packages/core/test/milestones.test.ts`

**Interfaces — Produces:**
- `SpecMeta.milestone: string | null` (front matter `milestone`, trimmed; empty → null)
- `ProjectConfig.milestones: string[]` (config key `milestones`, trimmed, empty strings dropped, duplicates dropped keeping first)
- `ProjectConfig.closingSteps: string[]` (config key `closing_steps`, already documented by skills; parse it now so the board can show it later)
- `SubtaskLog.pr: string | null` (log front matter `pr`)
- In `@specboard/core/milestones` (no Node imports):
  - `hasMilestones(config: { milestones: string[] } | null): boolean`
  - `milestoneOf(spec: { milestone: string | null }, milestones: string[]): string | null` — exact match after trim, else null
  - `groupByMilestone<T extends { milestone: string | null }>(specs: T[], milestones: string[]): { name: string | null; specs: T[] }[]` — one group per listed milestone in order (empty groups kept), then `{name:null}` "No milestone" only if non-empty
  - `currentMilestone(specs: { milestone: string | null; status: string }[], milestones: string[]): string | null` — first milestone with a spec not `done`; all done → last; no milestones → null. Archived specs are passed by the caller as done.
- Project load: when `config.milestones` is non-empty and a spec's `milestone` is set but not listed, push `Unknown milestone "<name>"` to that spec's `problems`.

- [ ] **Step 1: Write failing tests** in `milestones.test.ts`: parse `milestone: Basics` → `'Basics'`; config `milestones: [Basics, " Sharing ", "", Basics]` → `['Basics','Sharing']`; `closing_steps: [Write tests]` → `['Write tests']`; log `pr: https://github.com/o/r/pull/7` → that URL, missing → null; `groupByMilestone` order + "No milestone" last + empty listed groups kept; `currentMilestone` for (a) first unfinished, (b) all done → last, (c) `[]` → null; Review Focus 1 (`milestone: basics` with list `[Basics]` → problem `Unknown milestone "basics"`, `milestoneOf` null) and 2 (no list, `milestone: X` → no problem).
- [ ] **Step 2: Run** `npm test -w @specboard/core` → new tests FAIL.
- [ ] **Step 3: Implement** the fields, parsing and helpers above. Existing writers edit front matter in place, so check one round trip in the test: `setMeta` on a spec with `milestone:` keeps the line.
- [ ] **Step 4: Run** `npm test -w @specboard/core` and `npx tsc -p packages/core --noEmit` → PASS, clean.
- [ ] **Step 5: Commit** `core: milestones, closing_steps and PR links in logs`

### Task 2: Core tree renderer + `specboard tree`

**Files:**
- Create: `packages/core/src/tree.ts` (export from index), `packages/core/test/tree.test.ts`
- Modify: `packages/server/src/cli.ts` (new `tree` command), `packages/server/test/cli.test.ts`

**Interfaces:**
- Consumes: Task 1 helpers, `Project`, `Spec`.
- Produces: `renderTree(project: Project, opts?: { spec?: string; milestone?: string; subtasks?: boolean }): string` and CLI `specboard tree [--spec ID] [--milestone NAME] [path]` printing it (exit 1 with a one-line message when the folder has no `.specboard`, the ID or the milestone is unknown).

Format (exact, from the spec): header `<name> · <done>/<total> done` (total counts active + archived like the board's progress); `├─ `/`└─ ` branches with `│  ` continuation; milestone line `Milestone: <name> · <done>/<total>`; last group `No milestone` (only when the project has milestones); spec line `<ID> <title> · <status>` plus ` (draft)` when draft; next line the first sentence of the Spec section cut to 70 chars with `…`; subtasks `✓ n. title` / `○ n. title`, with `(you) ` steps shown as `○ n. you: title`. Archived specs are left out. `subtasks` defaults to true.

- [ ] **Step 1: Failing tests:** golden string for the recipe-box fixture without milestones; golden string for a two-milestone fixture; `--spec T-104` prints only that spec block; unknown spec → CLI exit 1.
- [ ] **Step 2: Run** core + server tests → FAIL.
- [ ] **Step 3: Implement** `renderTree` and the CLI command (load the project with core's existing loader).
- [ ] **Step 4: Run** tests → PASS.
- [ ] **Step 5: Commit** `core: tree view of a project; specboard tree`

### Task 3: `plugin/` folder, paths, init and start options

**Files:**
- Move: `packages/server/kit/skills/*` → `plugin/skills/*` (git mv)
- Create: `plugin/.claude-plugin/plugin.json` (`name: "specboard"`, `version: "0.2.0"`, `description`, `author: { name: "Kingsley Anyabuike" }`), `.claude-plugin/marketplace.json` at repo root (`name: "spec-board"`, `owner: { name: "Kingsley Anyabuike" }`, `plugins: [{ name: "specboard", source: "./plugin", description }]`), `packages/server/src/paths.ts`
- Modify: `packages/server/src/kit.ts`, `start.ts` (web dist path, `--detach`), `cli.ts` (`--version`, `init --no-skills --runs yes|no`, `--detach`), `setup.ts` (init options, default allow list), tests `kit.test.ts`, `setup.test.ts`, `cli.test.ts`, `init-self.test.ts`

**Interfaces — Produces:**
- `paths.ts`: `pluginDir(): string`, `webDistDir(): string | null`. Source build: `<repo>/plugin` and `<repo>/packages/web/dist`. Bundle (esbuild `define: { __SPECBOARD_BUNDLE__: 'true' }`): `<bundle dir>/..` and `<bundle dir>/../web`. `kitPluginDir()` returns `pluginDir()`; `--plugin-dir` in runs therefore gets `plugin/`.
- `initCommand(io, opts: { root; yes; forceSkills; noSkills?: boolean; runs?: 'yes' | 'no'; kitDir? })`: `noSkills` skips `installSkills`; `runs` answers the permissions prompt without a TTY (`yes` writes the defaults, `no` skips). `--yes` without `--runs` keeps today's behaviour.
- `defaultAllowList` adds `Bash(specboard tree:*)`, `Bash(gh pr view:*)`, `Bash(glab mr view:*)`.
- CLI: `specboard --version` prints the plugin.json version. `specboard [path] --detach`: if a board is already serving on the port, register + open and exit 0 (today's path); otherwise spawn itself detached (`--no-detach` internally, stdio ignored, `unref`), poll `/api/health` up to 10 s, print `Spec Board running at <url>` and exit 0; exit 1 with a message on timeout.

- [ ] **Step 1: Failing tests:** kit lists the same 11 skills from `plugin/skills`; plugin.json/marketplace.json parse and names match; `parseInitArgs(['--no-skills','--runs','yes'])`; init with `noSkills` writes no `.claude/skills`; init with `runs:'no'` and no TTY succeeds and writes no settings; default allow list contains the three new rules; `--version` output equals plugin.json version; `--detach` with a fake already-running server returns without spawning.
- [ ] **Step 2: Run** server tests → FAIL.
- [ ] **Step 3: Implement.** Update every import of the old kit path; `runPrompt` strings are unchanged.
- [ ] **Step 4: Run** `npm test` (all workspaces) and `npx tsc` per package → PASS.
- [ ] **Step 5: Commit** `plugin folder: skills move to plugin/, marketplace, init and start options`

### Task 4: Bundle build

**Files:**
- Create: `scripts/build-plugin.mjs`, `plugin/bin/specboard.mjs` (generated, committed), `plugin/web/**` (generated, committed), `packages/server/test/bundle.test.ts`
- Modify: root `package.json` (`"build:plugin": "npm run build -w @specboard/web && node scripts/build-plugin.mjs"`, esbuild devDependency), `.gitattributes` (mark `plugin/bin/*.mjs` and `plugin/web/**` as `-diff linguist-generated`)

**Interfaces:** Consumes `paths.ts` (`__SPECBOARD_BUNDLE__`). Produces a single ESM file with a `#!/usr/bin/env node` banner, platform node, target node22, all dependencies inlined (`@specboard/core` included), and `plugin/web` = a copy of `packages/web/dist`. On Windows the plugin `bin/` also needs `plugin/bin/specboard.cmd` (`@node "%~dp0specboard.mjs" %*`) and an extensionless POSIX shim `plugin/bin/specboard` (`#!/bin/sh` → `exec node "$(dirname "$0")/specboard.mjs" "$@"`).

- [ ] **Step 1: Failing tests** in `bundle.test.ts`: `node plugin/bin/specboard.mjs --version` prints the plugin.json version; `node plugin/bin/specboard.mjs tree examples/recipe-box` prints a tree starting `Recipe Box`; starting it with `--no-open --port 0` on a temp copy of the sample serves `/api/health` with `app: specboard` and `/` returns HTML; staleness: the bundle's mtime is not older than the newest file under `packages/*/src` or `plugin/skills` (message: "run npm run build:plugin").
- [ ] **Step 2: Run** → FAIL (no bundle).
- [ ] **Step 3: Implement** the script and run `npm run build:plugin`.
- [ ] **Step 4: Run** `npm test` → PASS.
- [ ] **Step 5: Commit** `plugin: bundled board and CLI`. (Every later task that changes `packages/*/src` or skills re-runs `npm run build:plugin` before its commit.)

### Task 5: Skills

**Files:** `plugin/skills/specboard/SKILL.md`, `create-spec`, `plan-project`, `import-specs`, `reorganize`, `next`, `run-spec` (if it repeats run rules), new `plugin/skills/setup/SKILL.md`, `plugin/skills/structure/SKILL.md`, `plugin/skills/sync-specs/SKILL.md`; `packages/server/test/kit.test.ts`

What each must say (from the spec, sections 1, 2, 3, 4, 10):
- `specboard` rules gain: **Proposing changes** (tree format exactly as in spec §2 with `+` `~` `→`, required before writing more than one spec; plan mode → tree and file list go in the plan, write nothing until approved); **Milestones** (`milestones:` in config, `milestone:` on specs, what a milestone is, current milestone); **Spec or subtask?** (the five bullets of spec §4 plus 2–3 recipe-box examples); logs: `pr:` key and how to find it (`gh pr view --json url -q .url`, then `glab mr view -F json`, skip silently); the `specboard tree` command with the build-from-files fallback.
- `setup` (no `disable-model-invocation`; description mentions "set up spec board"): the 9 steps of spec §1 in order, including `specboard init --yes --no-skills --runs <yes|no> <folder>`, moving old specs to `.specboard/imported/<source-name>/` only on "Spec Board only", and finishing with the summary then `specboard --detach <folder>`.
- `structure` (`disable-model-invocation: true`, `argument-hint: [ID | milestone]`): run `specboard tree` with the right flag and print it in a code block; read-only.
- `sync-specs` (`disable-model-invocation: true`, `argument-hint: [--board] [--dry-run | --apply]`): what it proposes (spec §10 four bullets); proposal file format (design "Calls made" item 2: front matter `created`, `head`, `changes`; body summary, tree, numbered operations); `--dry-run` writes only the proposal; `--apply` checks `head` against `git rev-parse --short HEAD`, stops with "The code changed since the proposal. Run Sync again." on mismatch, applies only listed operations, deletes the file; chat (no flags) shows summary + tree, asks, applies.
- `plan-project`, `import-specs`: ask small or large; write `milestones`; Wishflo-style whole-plan phases → milestones, Spec Kit/OpenSpec in-spec phases → ordered subtasks; show the tree first.
- `reorganize`: milestone create/rename/reorder/move; tree first.
- `next`: prefer the current milestone.
- `create-spec`: tree only when making more than one spec; set `milestone` to the current milestone unless told otherwise.

- [ ] **Step 1: Failing kit tests:** COMMANDS list includes `setup`, `structure`, `sync-specs`; `setup` has no `disable-model-invocation`; each new command skill loads `specboard`; rules contain the headings "Proposing changes", "Milestones", "Spec or subtask?"; rules mention `pr:`; sync-specs mentions `sync-proposal.md`, `head`, and "Run Sync again".
- [ ] **Step 2: Run** server tests → FAIL. **Step 3: Write the skills.** **Step 4: Run** → PASS; `npm run build:plugin`. **Step 5: Commit** `skills: setup, structure, sync, milestones, tree previews, spec or subtask`.

### Task 6: Server — tokens and sync runs

**Files:** `packages/server/src/claude/events.ts`, `classify.ts`, `runs.ts`, `routes/runs.ts`, new `packages/server/src/routes/sync.ts` (mounted in `app.ts`), `packages/server/test/fixtures/fake-claude.mjs`, tests `claude-events.test.ts`, `runs.test.ts`, `runs-routes.test.ts`, new `sync-routes.test.ts`; web `packages/web/src/api/client.ts` types

**Interfaces — Produces:**
- `ClaudeResult.usage: { input: number; output: number; cacheRead: number; cacheWrite: number } | null` and `costUsd: number | null` (from `usage.input_tokens`, `output_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens`, `total_cost_usd`; missing → null).
- `EndInfo.tokens?: { total: number; input: number; output: number; cacheRead: number; cacheWrite: number }` (`total` = input + output + cacheRead + cacheWrite). Mirrored in web `EndInfo`.
- `formatTokens(n: number): string` → `"950"`, `"48.2k"`, `"1.3M"` (export from `runs.ts`; web has its own copy in `lib/` since it can't import server).
- Final run line: when tokens are known, append ` · <formatTokens(total)> tokens` to the final line's text for every end status.
- Log entry: for `run` kind only, after the run ends, if any log file under the spec's `logs/` changed during the run, append to the most recently modified one: `\n### <local YYYY-MM-DD HH:mm>\nBackground run used <total> tokens (in <input>, out <output>, cache <cacheRead> read) across subtasks <a>–<b>.\n` (`<a>–<b>` = lowest–highest subtask numbers whose log changed; single number when one). Numbers via `formatTokens`. Nothing when tokens are null.
- `RunKind` adds `'sync-plan' | 'sync-apply'`; `runPrompt('sync-plan')` = `/specboard:sync-specs --board --dry-run`, `runPrompt('sync-apply')` = `/specboard:sync-specs --board --apply`; both project-level like `refresh-overview`. `sync-plan` that ends `finished` without `.specboard/sync-proposal.md` existing becomes `{status:'error', title:'Claude stopped before finishing', text:'No sync proposal was written.'}`. `FINISHED_TEXT`: `sync-plan` → "Sync proposal ready", `sync-apply` → "Board synced with the code".
- Routes: `GET /api/projects/:pid/sync-proposal` → `{ exists: false }` or `{ exists: true, head: string | null, changes: number | null, created: string | null, bodyMd: string, problems: string[] }`; `DELETE` same path → removes the file (204, idempotent). The file watcher already broadcasts changes under `.specboard/`; make sure a create/delete of this file emits a project change event.

- [ ] **Step 1: Failing tests:** parse a result line with usage → numbers; without usage → null (Review Focus 4); fake-claude scenario `tokens` ends with final line text ending ` · 48.2k tokens` and appends the exact log entry to the right log; no-usage scenario appends nothing; `formatTokens` cases 950 / 48210 / 1300000; sync-plan scenario that writes the proposal → finished "Sync proposal ready"; one that doesn't → error text; GET/DELETE proposal routes incl. broken front matter → `problems` non-empty, `bodyMd` still returned.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** server tests + tsc → PASS; `npm run build:plugin`. **Step 5: Commit** `server: token counts in runs and logs; sync runs and proposal API`.

### Task 7: Web — manual mode notice

**Files:** Create `packages/web/src/components/ManualNotice.tsx` (+ `.module.css`, `.test.tsx`, `.stories.tsx`); modify `TopBar.tsx` (prop), `App.tsx`, `packages/web/src/state/runUi.ts`

**Interfaces — Produces:**
- `manualReason(claude: ClaudeStatus | null, approved: boolean | null): 'not-installed' | 'not-logged-in' | 'blocked' | 'not-approved' | null` in `runUi.ts` (null = runs available; unknown status (null) → null so nothing flashes while loading). Order: not installed → blocked (`blockedBy`) → not logged in → not approved.
- `<ManualNotice reason={...} />`: a button showing the info icon and "Manual"; click toggles a panel (Esc and outside click close it, using the existing menu pattern) with title "Non-agentic mode", the text "The board can't run Claude for you here, so use the Copy command buttons and paste them into a Claude chat.", one reason line (`not-installed`: "Claude Code isn't installed on this computer." / `not-logged-in`: "Claude Code isn't logged in." / `blocked`: "Claude Code is blocked by a setting." / `not-approved`: "This project isn't set up for background runs."), and a link "How to turn on background runs" → `/docs/running-specs#turn-on-background-runs` (new tab). TopBar renders it before the live dot when `manual` is non-null.

- [ ] **Step 1: Failing tests:** `manualReason` table; notice hidden when null; opens and shows the reason line and link href; Esc closes.
- [ ] **Step 2–4:** run, implement, run web tests + tsc → PASS. **Step 5: Commit** `web: manual mode notice in the header`.

### Task 8: Web — Board/Table switch, milestone dropdown, table view

**Files:** Create `packages/web/src/components/TableView.tsx` (+ css, test, story), `packages/web/src/state/viewMode.ts`; modify `FilterBar.tsx`, `App.tsx`, `Board.tsx` (no logic change beyond receiving filtered specs), `packages/web/src/state/filters.ts`, `packages/web/src/lib/tour.ts` (welcome step mentions the Table switch; add target `view` to the filters step text)

**Interfaces:**
- Consumes: `@specboard/core/milestones` helpers (Task 1), `sortSpecs`, `filterSpecs`, `youStep`.
- Produces:
  - `viewMode.ts`: `VIEW_KEY = 'specboard.view'`, `initialView(): 'board' | 'table'`, `saveView(v)` (same storage pattern as Simple mode).
  - `Filters` gains `milestone: string | null` meaning "board shows only this milestone"; `null` = all. `NO_FILTERS.milestone = null`. `filterSpecs` applies it only when given a milestone list: signature becomes `filterSpecs(specs, filters, milestones: string[] = [])`. "No milestone" is selectable as the sentinel string `'\u0000none'` exported as `NO_MILESTONE`.
  - On project load, when the project has milestones, the filter starts at `currentMilestone(...)` (archived counted as done).
  - FilterBar gets: a segmented control `Board | Table` (`role="radiogroup"`, `aria-label="View"`, `data-tour="view"`), and when milestones exist and the view is Board, a milestone dropdown button labelled with the selected name (menu: each milestone with done/total, "No milestone" if any, then "All milestones").
  - `<TableView specs archived milestones simple onOpen />`: columns ID, Title (button → `onOpen(id)`), Status (existing StatusChip), Progress `done/total`, Urgency + Categories (hidden when `simple`), a "you" marker when the spec is waiting on the person (same rule the card uses). Each spec row has an expand button (`aria-expanded`, closed by default) revealing its subtasks (number, title without `(you)` prefix, tick, you tag). With milestones: one section per `groupByMilestone` group, heading `<name> · <done>/<total>` (or "No milestone"), open by default, collapsible. Archived specs in a closed "Archived" section. Sorted with `sortSpecs` within status order todo → doing → review → done. Empty states: no specs at all → "No specs yet."; empty milestone → "No specs in this milestone yet." (Review Focus 5). The whole table sits in a horizontally scrollable wrapper.
  - The table ignores the milestone filter but applies category/urgency/blocked filters.

- [ ] **Step 1: Failing tests:** view toggles and persists; dropdown absent without milestones; default selection is the current milestone; Board shows only that milestone's cards, "All milestones" shows all; table rows match board card count under the same filters; expand shows subtasks; sections open by default and collapse; Simple mode hides urgency/categories columns; both empty states.
- [ ] **Step 2–4:** run, implement, run web tests + stories + tsc → PASS. **Step 5: Commit** `web: table view and milestone switcher`.

### Task 9: Web — Overview Summary and Tasks

**Files:** `packages/web/src/components/OverviewModal.tsx` (+ test, story), `packages/web/src/lib/exportOverview.ts` (+ test)

**Interfaces:** Consumes `groupByMilestone`, and a read-only compact mode of Task 8's table: `<TableView ... compact />` (no expand, no urgency/categories, no archived section, titles not clickable). Produces export text:
```
# <name>

<description>

## Counts
- To-do: n …(unchanged)

## Summary
<summary>

## Tasks
### <milestone> (only when milestones)
| ID | Title | Status | Progress |
| --- | --- | --- | --- |
| T-101 | Recipe list page | Done | 4/4 |
```
Status words: To-do, Doing, Review, Done. Pipes in titles escaped as `\|`. Without milestones, one table directly under `## Tasks`. A "No milestone" group is headed `### No milestone`.

- [ ] **Step 1: Failing tests:** label reads "SUMMARY" not "PROGRESS"; Tasks toggle collapsed by default, expands to a table with one row per active spec; export golden text with and without milestones, including an escaped pipe.
- [ ] **Step 2–4:** run, implement, run → PASS. **Step 5: Commit** `web: overview summary and tasks table, export includes them`.

### Task 10: Web — Sync with code

**Files:** Create `packages/web/src/components/SyncDialog.tsx` (+ css, test, story); modify `TopBar.tsx` (menu items), `App.tsx`, `packages/web/src/api/client.ts` (`api.syncProposal(pid)`, `api.discardSyncProposal(pid)`, RunKind additions), `packages/web/src/state/runUi.ts` (toasts for the two kinds)

**Interfaces:** Consumes Task 6 routes and run kinds, Task 7 `manualReason`.
- Logo menu (board page): "Sync with code" always; plus "Sync proposal waiting" (with a dot) when the proposal exists.
- Click "Sync with code":
  - manual mode → dialog "Sync needs Claude" explaining it, with the command `/specboard:sync-specs` and a Copy button (copy + toast like the existing copy-command flow).
  - otherwise start a `sync-plan` run; the dialog shows "Claude is reading your code…" with the live run lines and a Stop button; when the run ends and the proposal exists, the dialog switches to the confirm view.
- Confirm view: warning line `This will change <changes> specs.` (or "This will change your specs." when `changes` is null), the proposal body rendered with the existing Markdown component, buttons Cancel (calls DELETE, closes) and Confirm (starts `sync-apply`, dialog shows progress, closes on finish with the existing toast). When `problems` is non-empty: show "This proposal can't be read safely." above the body, Confirm disabled, Discard available (Review Focus 3).
- Opening the board while a proposal exists does not pop the dialog; the menu item does.

- [ ] **Step 1: Failing tests:** manual mode shows the command; plan run → confirm view with the change count; Cancel calls discard; Confirm starts `sync-apply`; broken proposal disables Confirm; "Sync proposal waiting" appears only when the file exists.
- [ ] **Step 2–4:** run, implement, run → PASS. **Step 5: Commit** `web: sync with code`.

### Task 11: Web — PR links and tokens in the detail view

**Files:** `packages/web/src/components/detail/SubtaskLog.tsx` (+ test/story), `RunPanel.tsx` (no change needed if the final line already carries the text; verify)

**Interfaces:** Consumes `SubtaskLog.pr`. Show a link "PR" (GitHub/GitLab icon not required; text link with the external-link behaviour the file links use) next to the commit hash when `pr` is set, opening in a new tab with `rel="noopener noreferrer"`. Only `http(s)` URLs become links; anything else shows as plain text.

- [ ] **Step 1: Failing tests:** pr link renders with href; `javascript:` value renders as text. **Step 2–4.** **Step 5: Commit** `web: PR link in subtask logs`.

### Task 12: Web — small screens

**Files:** `Board.module.css`, `Column.tsx` (if needed), `TopBar.tsx` + css (overflow "⋯" menu), `FilterBar.module.css`, `components/detail/detail.module.css`, `Modal.module.css`, `Footer.module.css`, `Board.module.css .fab`, new tests in `TopBar.menu.test.tsx`

**Interfaces:** Breakpoints: `@media (max-width: 1100px)` board → `display:flex; overflow-x:auto; scroll-snap-type:x mandatory`, columns `flex: 0 0 300px; scroll-snap-align:start`, each column `max-height: calc(100vh - 170px); overflow-y:auto`; `@media (max-width: 720px)` TopBar hides References, Overview and the manual notice behind a "More" button (`aria-label="More"`, MoreIcon) whose menu holds the same actions, and the switcher hides its progress text; filter bar becomes one horizontally scrolling row; `@media (max-width: 640px)` card detail and modals full-screen (`inset:0; border-radius:0; max-width:none`), fab becomes a 48px round "+" with the label visually hidden (`aria-label` kept). TopBar decides "narrow" with `matchMedia('(max-width: 720px)')` via a small `useNarrow()` hook in `packages/web/src/lib/useNarrow.ts` (listens to changes; false when matchMedia is missing).

- [ ] **Step 1: Failing tests:** with `matchMedia` mocked narrow, References/Overview are inside the More menu and still work; wide → buttons shown, no More.
- [ ] **Step 2–3:** implement. **Step 4:** web tests + stories; then check in the browser at 375, 768 and 1280 widths (board, table, detail, overview) and fix what overflows. **Step 5: Commit** `web: small screens`.

### Task 13: Docs, README, sample

**Files:** `README.md`, `docs/guide/getting-started.md`, `commands.md`, `writing-specs.md`, `running-specs.md` (add `## Turn on background runs` → anchor `turn-on-background-runs`, tokens, PR links, manual mode, sync), `docs/documentation.md`, `docs/future-features.md`, `examples/recipe-box/.specboard/config.md` (`milestones: [Basics, Planning]`), sample specs' `milestone:` keys, one sample log with `pr: https://github.com/kingsleykbc/claude-spec-board/pull/1`, `packages/web/src/fixtures/recipeBox.ts` to match, tests that assert on the sample.

Content: README leads with installing the plugin (the two commands), then `/specboard:setup`, then the terminal route; feature list adds milestones, table view, sync, manual mode. Commands page lists `setup`, `structure`, `sync-specs`. Writing specs: Milestones and "Spec or subtask?". Getting started: plugin first. Future features: remove nothing that wasn't built; add "Token counts for work done in a chat". Do not touch `git stash@{0}`.

- [ ] **Step 1:** update the sample and fixture; run all tests; fix sample-dependent assertions.
- [ ] **Step 2:** write the docs; check every command name and flag against the skills and CLI.
- [ ] **Step 3:** `npm run build:plugin`; `npm test`; tsc for all packages; stories.
- [ ] **Step 4: Commit** `docs: plugin install, milestones, table view, sync; sample milestones`.
