# Plugin, milestones, table view and sync (design)

Date: 2026-11-14. Status: waiting for Kingsley's approval.

## Why

Kingsley wants to work in one place, the Claude chat, with the board as a view of it. Today Spec Board has to be set up from a terminal, only knows one level of grouping (spec › subtask), only shows a kanban, and says little when Claude runs are not available. Bigger projects (Wishflo, with its phase plans) need a level above specs, and existing projects need a way to bring the board back in line with the code.

The rule from earlier rounds still holds: **a simple, manageable way to track projects, with the most insight and the least friction, digging or confusion.** Wherever simple and thorough pull apart, simple wins.

## Goals

1. Spec Board installs as a Claude Code plugin from the GitHub repo. "Set up spec board here" (or a command) sets up any project, new or existing.
2. Before Claude creates or converts more than one spec, it shows the proposed structure as a tree and waits for an OK. A command shows the current structure the same way.
3. Larger projects can group specs into **milestones**: Project › Milestone › Spec › Subtask. Small projects stay Project › Spec › Subtask.
4. Logs say more: a PR/MR link when there is one, and tokens used by background runs. Claude knows how to tell a spec from a subtask.
5. The board works on small screens.
6. When the board can't run Claude, it says so plainly in the header.
7. A table view next to the board view.
8. The Overview has a "Summary" and a "Tasks" table, and the export includes both.
9. "Sync with code" brings the board in line with the project, after showing what will change.

## Non-goals

- Project-level phases named "phase". Spec Kit and OpenSpec use "phase" for task groups inside one spec, so the top level is called **milestone** to avoid confusion. *(Claude's call, Kingsley offered other names.)*
- Task groups inside a spec. Imports keep task order but not group headings.
- Publishing to npm. The plugin ships a ready-built file instead.
- Token counts for work done in a chat. Claude in a chat cannot see its own usage; only background runs report it.
- Live mirroring of chat activity on the board, and an "Add project" form (still waiting, separate work).

## Anti-goals (a failure even if it works)

- A small project that has to think about milestones at all.
- Sync or setup that deletes the person's files without asking.
- A table view that shows different numbers from the board.
- Claude writing a batch of specs nobody saw first.

## 1. The plugin

### Layout
- Repo root gets `.claude-plugin/marketplace.json` (marketplace name `spec-board`, owner Kingsley) with one plugin entry, source `./plugin`.
- `plugin/.claude-plugin/plugin.json`: name **`specboard`** (so commands are `/specboard:create-spec`, which the board's run prompts already use), description, author, `version` (bumped on each release so installs update on purpose).
- `plugin/skills/`: the kit skills. **One source of truth:** the skills move from `packages/server/kit/skills/` to `plugin/skills/`, and `specboard init` copies from there. Kit tests follow the move.
- `plugin/bin/specboard.mjs`: the whole CLI and server in one self-contained file (bundled with esbuild, which Vite already brings in), plus the built web app in `plugin/web/`. No `package.json` in `plugin/`, so the plugin installs with no npm step. `bin/` is on Claude's PATH while the plugin is on, so skills run `specboard …` directly.
- A root script `npm run build:plugin` makes `plugin/bin` and `plugin/web`. Both are committed (an install can't build). A test checks the bundle runs `specboard --version` and serves the board.
- Install, for the docs and README: `/plugin marketplace add kingsleykbc/claude-spec-board` then `/plugin install specboard@spec-board`.

### `/specboard:setup [folder]` (new; also used for "set up spec board here")
Not `disable-model-invocation`, so plain requests trigger it. Steps:
1. **Where.** Ask which project folder, default the current one. If it already has `.specboard/`, say so and offer `/specboard:structure`, an import, or a sync instead.
2. **Look first.** Search the folder for existing plans: Spec Kit (`specs/*/spec.md`, `tasks.md`), OpenSpec (`openspec/`), roadmap or plan documents (README roadmaps, `docs/plans`, `*plan*.md`, `TODO.md`). Say what was found in a few lines.
3. **Choose.** If something was found, ask: import it, or start from scratch. If nothing was found, go straight to "from scratch" and say so.
4. **Small or large.** Ask whether the project needs milestones (suggest yes when the plans already have phases or more than about 12 pieces of work).
5. **Preview.** Show the proposed structure as a tree (section 2) and wait for an OK or changes.
6. **Set up.** Run `specboard init --yes <folder>` (creates `.specboard/`, registers the project; the plugin's own skills are used, so no skills are copied into the project when run from the plugin; see "Init from the plugin" below). Then write the specs: import uses the `import-specs` rules, from scratch uses the `plan-project` rules (drafts for the first specs, full write-ups one at a time later).
7. **Old specs, after an import.** Ask: keep both, or Spec Board only. "Spec Board only" moves the old files into `.specboard/imported/<source-name>/` (never deletes). Keep both changes nothing.
8. **Background runs.** Ask whether the board may run Claude in the background. Yes: write the allow/deny rules (same as `specboard init`'s prompt) after showing them. No: the board works in manual mode (section 6).
9. **Finish.** A chat summary of everything done (files made, specs created, what was moved, whether runs are on), then start the board with `specboard --no-wait <folder>` in the background so it opens in the browser.

### Init from the plugin
- `specboard init` gains `--no-skills` (skip copying skills into `.claude/skills/`) and `--runs yes|no` (answer the permissions prompt without a TTY). Setup passes `--yes --no-skills`. A terminal `specboard init` keeps working as today.
- `specboard` (start) gains a way to run in the background from a skill without blocking Claude: if a board server is already running for this machine it registers the project and opens the browser; otherwise it starts detached and returns. *(Builder: pick the mechanism; the requirement is that the skill's Bash call returns quickly and the board stays up.)*

### Plan mode
Every skill that creates or changes specs: if Claude is in plan mode, put the tree preview and the list of files to write **in the plan**, write nothing, and do the work after the plan is approved. Outside plan mode, show the tree in the chat and wait for an OK.

## 2. Tree preview and `/specboard:structure`

### The tree
Shown in a code block. One line per item; spec lines carry ID, title, status, and the first sentence of the description, cut to about 70 characters. Subtasks show their number and a tick. Milestones show their done/total.

```
Recipe Box · 3/9 done
├─ Milestone: Basics · 2/4
│  ├─ T-101 Recipe list page · done
│  │    A grid of saved recipes with photo, cook time and tags.
│  │    ├─ ✓ 1. Build the grid
│  │    └─ ✓ 2. Write tests
│  └─ T-104 Meal planner calendar · doing
│       A weekly calendar where recipes can be dragged onto days.
│       ├─ ✓ 1. Calendar layout
│       └─ ○ 2. Drag and drop
└─ No milestone
   └─ T-107 Dark mode · todo (draft)
        Respect the system theme and add a manual toggle.
```

- Projects without milestones have no milestone level.
- A proposed (not yet written) tree marks new items with `+`, changed ones with `~`, and moved-away ones with `→ <where>`. The same format is used by setup, `plan-project`, `import-specs`, `reorganize`, `create-spec` when it makes more than one spec, and sync.
- `create-spec` for a single spec does not need a tree (the spec itself is shown), keeping the common case fast.

### `/specboard:structure [ID | milestone]`
- Prints the current tree. With an ID, just that spec with its subtasks; with a milestone name, just that milestone.
- Built by a new CLI command `specboard tree [--spec ID] [--milestone NAME] [path]` from a shared core function, so the output is the same every time. The skill runs it; if the `specboard` command is not on the PATH (a project set up with plain `init`), the skill builds the tree from the files by the same rules.
- Read-only.

## 3. Milestones

- `config.md` gains an optional ordered list: `milestones: [Basics, Sharing, Polish]`.
- A spec's front matter gains optional `milestone: Basics`.
- A project **has milestones** when the list is not empty. Then specs with no or an unknown milestone show under "No milestone" (last), and the board flags an unknown name as a file problem like other front-matter problems.
- **Current milestone:** the first in the list that has any spec not done; if all are done, the last one.
- Core: parse both keys, add `milestone` to the spec type and `milestones` to the config type, and give the server API what it needs. Writes (move, archive, etc.) keep the key.
- Skills:
  - `specboard` (rules): document both keys; a milestone is a group of specs that ship together; specs depend across milestones as normal.
  - `plan-project` and setup ask small or large; large writes the list and sets each spec's milestone.
  - `import-specs`: phases of a whole plan (Wishflo-style phase plans) become milestones; Spec Kit / OpenSpec in-spec phases stay as ordered subtasks.
  - `reorganize` can create, rename, reorder milestones and move specs between them.
  - `next` picks from the current milestone first.

## 4. Logs and spec size

### PR/MR links
- After a subtask's commit, if the current branch has an open pull/merge request, record its link: try `gh pr view --json url -q .url`, then `glab mr view -F json`, and skip silently if neither works or there is none. If Claude opens a PR/MR itself, use that link.
- Stored as `pr: <url>` in the log's front matter (next to `commit` and `files`). Core parses it; the detail view shows it as a link beside the commit.

### Tokens
- Background runs: the server reads `usage` (input, output, cache read, cache write) and `total_cost_usd` from Claude's final result event.
- The run panel's last line shows the total, e.g. "Used 48.2k tokens".
- The server appends one dated entry to the log of the **last subtask the run worked on** (or the log the Done-when check went in): "Background run used 48.2k tokens (in 41.0k, out 7.2k, cache 120k read) across subtasks 2–4." If the run touched no log, nothing is written.
- Chat work records no tokens; the docs say why.

### Spec or subtask
A short "Spec or subtask?" part in the `specboard` rules, used by every skill that writes specs:
- A **spec** is a result the person would want to follow as its own card: it changes what someone can see or do, has its own "Done when", can be reviewed on its own, and takes several sittings (about 2–8 subtasks).
- A **subtask** is one step toward a spec: one commit, one sitting, not worth reviewing alone.
- A **milestone** is a set of specs that ship together.
- Signs to split a spec: more than about 8 subtasks, Done-when lines about unrelated things, or parts that could ship apart. Signs to merge: a spec with one subtask, or two specs that can't be reviewed apart.
- Two or three short examples from the sample project.

## 5. Small screens

- Under about 1100px the four columns become a row of fixed-width (about 300px) columns that scroll sideways, snapping to each column. Each column scrolls on its own when tall.
- Top bar under about 720px: References, Overview and the manual-mode icon move into a "⋯" menu; the project switcher keeps the name and drops the progress text.
- Filter bar wraps; on phones its controls scroll sideways in one row.
- Card detail becomes full-screen on phones. Modals fit the screen width.
- The table view scrolls sideways inside its own box.
- The "Add new spec" button shrinks to a round "+" on phones.
- Checked at 375px, 768px and desktop.

## 6. Manual mode notice

- The board is in **manual mode** (the person's word: "non-agentic") when background runs can't happen for this project: Claude Code is not installed, is not logged in, is blocked, or the project has not been approved for runs.
- The header shows an info icon with the word "Manual" next to the live dot. Clicking it opens a small panel: "Non-agentic mode. The board can't run Claude for you here, so use the Copy command buttons and paste them into a Claude chat." The reason in one line (not installed / not logged in / not set up for runs), then a link to the docs section on turning runs on.
- Not shown when runs are available.
- The docs get a "Turn on background runs" section (plugin: `/specboard:setup`; terminal: `specboard init`).

## 7 and 8. Board and table views

- A two-button switch, **Board | Table**, in the filter bar. The choice is kept in the browser like Simple mode.
- Filters (category, urgency, blocked) apply to both views.
- **Milestones in the board view:** a milestone dropdown in the filter bar, set to the current milestone on load, with "All milestones" at the bottom. The board shows only that milestone's specs. Projects without milestones have no dropdown.
- **Table view:**
  - One row per spec: ID, title (click opens the detail), status, progress (done/total), urgency and categories (hidden in Simple mode), waiting-on-you marker.
  - Each spec row expands to its subtasks (number, title, done tick, "you" tag), closed by default.
  - With milestones: one section per milestone (title, done/total), open by default, collapsible, then "No milestone". The table always shows all milestones; the milestone dropdown is for the board only.
  - Archived specs are listed under a closed "Archived" section at the end.
  - Sorted like the board: by milestone, then status order, then the board's own order within a status.
- Both views read the same data, so counts always match.

## 9. Overview

- The "Progress" label becomes **Summary**.
- Under the summary, a **Tasks** section, collapsed by default with a toggle: a read-only table of every spec (ID, title, status, progress), grouped by milestone when the project has them. It reuses the table view's parts without the expand-to-subtasks.
- The Markdown export becomes: name, description, `## Counts`, `## Summary` (was Progress), `## Tasks` (one Markdown table per milestone, or one table).

## 10. Sync with code

- New skill `/specboard:sync-specs [--board] [--dry-run | --apply]`.
- What it does: reads the code, the git history and the logs, and compares them with the specs. It proposes:
  - subtasks to tick (with the commit or code that shows them done) or untick (only with clear evidence the work was removed);
  - status moves (never to Done; finished work goes to Review);
  - new specs for clear work found in the code with no card (as drafts, or in Review when finished);
  - specs that no longer match anything, to archive (never delete).
- **In a chat:** shows a summary of changes and the tree with `+`/`~`/`→` marks, asks for an OK, then applies.
- **From the board:** the menu under the logo gets "Sync with code".
  - When runs are available: the board starts a background run with `--board --dry-run`. Claude writes the proposal to `.specboard/sync-proposal.md` (summary list and tree) and changes nothing else. The board opens a confirmation dialog with a warning ("This will change N specs"), the proposal, and Confirm / Cancel. Confirm starts a second run with `--board --apply`, which applies exactly that proposal and then deletes the file. Cancel deletes the file.
  - When runs aren't available (manual mode): the dialog explains it needs Claude and gives the command to copy: `/specboard:sync-specs`.
- New run kinds on the server: `sync-plan` and `sync-apply`, with the same run panel, toasts and run-ending rules as the others.

## Repo housekeeping (no design needed)

- Drop the "Co-Authored-By: Claude" line from all commits (history rewrite, then force-push), and leave it off from now on.
- Update `README.md` (install as a plugin first, terminal second, new features) and `docs/guide/*` (getting started with the plugin, commands, writing specs: milestones and "spec or subtask", running specs: tokens, PR links, manual mode, sync), `docs/documentation.md` (format additions) and `docs/future-features.md` (remove what is now built; add "token counts for chat work").
- Update the sample `examples/recipe-box`: give it two milestones, and give one log a `pr:` link, so the board shows them. Kingsley's stashed test edits stay untouched.

## Constraints

- Windows 11, Node 22, existing npm workspaces. esbuild is the only new tool, and it is already present through Vite; add it as an explicit dev dependency.
- Old projects (no milestones, no `pr:`, no plugin) keep working unchanged.
- All existing tests and stories keep passing, with new ones for each feature.
- Skills stay short and plain.

## Calls made after the builder check (Claude's calls)

1. **Run permissions.** Background runs already pass the kit folder with `--plugin-dir`. It now points at `plugin/`, so `bin/specboard` is on the PATH in runs too. The default allow list gains `Bash(specboard tree:*)`, `Bash(gh pr view:*)` and `Bash(glab mr view:*)`. Sync needs nothing else (git log/diff and file edits are already allowed). Projects approved before this keep their list. If a run is refused a command, it ends with the existing "permission" message, which tells the person to re-run setup or `specboard init` to update the list. PR links and the shared tree are optional in runs: a refusal there is skipped, not an error.
2. **Sync proposal file.** `.specboard/sync-proposal.md` has front matter `created`, `head` (the git commit it was made against) and `changes` (count). The body has the summary list and the tree, then a numbered list of exact operations, one per line ("Tick T-104 subtask 2 (commit a1b2c3d)", "Move T-106 to review", "Archive T-090", "Create draft: <title> in <milestone>"). The board just shows the body. The apply run re-reads the file, stops with a clear message if `head` is no longer the current commit ("the code changed since the proposal; run Sync again"), and applies only the listed operations. If the browser is closed between the two runs, the board finds the file on its next load and shows a "Sync proposal waiting" item in the logo menu that reopens the dialog. A missing file means there is nothing to confirm.
3. **Run prompts and endings.** `sync-plan` is `/specboard:sync-specs --board --dry-run` and `sync-apply` is `/specboard:sync-specs --board --apply`. Both are project-level like `refresh-overview` (no spec ID). A `sync-plan` that ends without writing the proposal ends as "stopped before finishing". Changes to other files during `sync-plan` are not policed by the server; the skill forbids them.
4. **Tokens when missing.** The result event's `usage` is not parsed today; it will be. No result event (stopped, crashed) means no token line anywhere. `write-up`, `refresh-overview` and sync runs show tokens in the run panel only, since they work on no subtask log.
5. **Bundle.** The server reads the web build and the kit from disk; the bundle resolves both relative to itself (`plugin/web`, `plugin/skills`). A test fails when `plugin/bin/specboard.mjs` is older than the newest file under `packages/*/src`, so a stale bundle is caught before a commit. There is no CI.
6. **Table order.** Uses the board's existing sort (`sortSpecs`) within each status, so both views list specs in the same order.
7. **History rewrite.** Done last, after the feature work and review: rewrite `main` and the two old merged branches to drop the Claude line, then force-push `main`. The stash keeps its own copy of the old commits, so Kingsley's test edits are unaffected. Kingsley has already approved this.

## Left to the builder

- How the tree is drawn in code and where the shared function lives (core is the natural home).
- The detached start mechanism for the board.
- Exact breakpoints and how the table looks, within the rules above.
- The manual-mode icon and panel styling.
- Wording of skills and dialogs.

## Round 2 additions (Kingsley, 2026-11-14, during the build)

### 11. Sync one card
- Every card detail gets a **Sync** button (next to Run). It does the same as Sync with code, for that spec only: `/specboard:sync-specs <ID> [--board] [--dry-run | --apply]`.
- Same proposal file and dialog. The proposal's front matter gains `scope: <ID>` (absent = whole project). The apply run checks the scope as well as `head`.
- Run kinds `sync-plan` and `sync-apply` take an optional spec ID; with one, the run is shown in that card's run panel like a normal run.
- Manual mode: the dialog gives `/specboard:sync-specs <ID>` to copy.

### 12. Settings (`.specboard/settings.md`)
- A new optional file, front matter only: `track_tokens: true` (default true when the file or key is missing). Room for more settings later.
- Core parses it (`ProjectSettings { trackTokens: boolean; problems }`) and the project data carries it. The board writes it through a small API (`PUT /api/projects/:pid/settings` with `{ trackTokens }`), creating the file when missing.
- The logo menu gets **Settings**, opening a small modal with the one switch: "Track tokens: record the tokens Claude uses for each subtask in its log."

### 13. Tokens per subtask (replaces the server log entry in section 4)
- A **plugin hook** does the counting, so it works in chats and background runs alike (background runs load the plugin through `--plugin-dir`). `plugin/hooks/hooks.json` registers a `PostToolUse` hook on `Write|Edit|MultiEdit` that runs `node "${CLAUDE_PLUGIN_ROOT}/bin/specboard.mjs" hook-tokens`.
- The hook reads the event from stdin. If the edited file is `…/.specboard/specs/<spec>/logs/<n>-*.md` and the project's `track_tokens` is on, it reads the session transcript (`transcript_path`), sums `message.usage` (input + output + cache read + cache write) over assistant entries, counting each `message.id` once, and subtracts the total it recorded at the previous log write in this session (kept in `${CLAUDE_PLUGIN_DATA}/tokens/<session_id>.json`; the first log write of a session counts from the session start). It adds the difference to the log's front matter `tokens:` (integer, cumulative across sittings) and saves the new checkpoint. Any failure exits 0 silently, so a hook problem never blocks Claude.
- The count is an honest approximation: tokens spent between one log write and the next go to the later subtask. The docs say so.
- Core parses `tokens` on logs (`SubtaskLog.tokens: number | null`). The detail view shows it next to the commit ("48.2k tokens").
- Projects set up with plain `specboard init` (no plugin) get no token counts; the docs say so.
- The server still shows a background run's total in the run panel's last line (section 4), but no longer appends a log entry.

### 14. Token totals
- Table view: a **Tokens** column = sum of the spec's log `tokens` (blank when none). Hidden when tracking is off.
- Overview: under the counts, "Tokens used: 1.2M" for the whole project (active + archived), hidden when tracking is off or the total is 0. The export adds `- Tokens used: …` under Counts when shown.

### 15. Dates and times (check and fill gaps)
- Today: specs have `created`/`updated` dates; every log entry has a `### YYYY-MM-DD HH:mm` heading. Projects have no date.
- Add: `created:` (date) in config.md, written by `init`/setup; logs gain `done_at:` (local date-time `YYYY-MM-DD HH:mm`) written when Claude ticks a subtask. The rules require a time in every log entry heading (already) and say `updated` changes on every spec edit.
- The board shows `done_at` in the subtask log header and the spec's created/updated dates in the detail view footer if not already shown.

### 16. Logs after a sync
- Sync never deletes or rewrites log entries and never changes `created`.
- When sync unticks a subtask, archives a spec, or finds a log describes work that no longer exists, it adds `obsolete: "<YYYY-MM-DD>: <short reason>"` to that log's front matter and a dated entry "Marked obsolete by sync: <reason>".
- The board shows a warning icon on obsolete logs; hovering or tapping shows "Obsolete since <date>: <reason>". Obsolete logs' tokens still count (they were spent).

### 17. All logs
- A **Logs** button in the header next to Overview opens a modal with every log entry of the project (active and archived specs), newest first, grouped by day ("Today", "Yesterday", then dates).
- Each entry: time, spec ID and title, subtask number and title, the entry text, tokens if any, the obsolete icon. Clicking the spec opens its detail.
- A search box filters by text, spec ID, spec title or subtask title (case-insensitive), live.
- The Overview gets a "View all logs" link that opens it; the Logs modal has an "Open overview" link back.

### 18. Header changes
- **Simple mode:** References, Overview and Logs move into the logo dropdown (below its title), instead of the header.
- The "Live" text goes. The connection shows as a dot next to the project name in the switcher (green connected, amber reconnecting, red disconnected, with the old text as its tooltip). In the switcher's list, each project gets a green dot when its folder is reachable and grey when not (the projects API gains `available: boolean`). *(Claude's call on what "live" means for other projects.)*
- The dark-mode toggle moves into the logo dropdown, as "Dark mode" with a switch.
- On small screens these merge with section 5's "More" menu: everything in the dropdown.

### Obsidian (question, no change)
Not built. The specs are already plain Markdown with YAML front matter, so `.specboard/` can be opened as an Obsidian vault today for its search and graph. A deeper integration (wikilinks for dependencies, an Obsidian plugin) would add a second way to edit the same files for little gain. Noted in future features as "Obsidian vault tips" only.
