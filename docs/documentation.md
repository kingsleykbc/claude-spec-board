# Claude Spec Board: Design

**Date:** 2026-11-07
**Status:** Reviewed, waiting for Kingsley's approval
**Working name:** claude-spec-board

> **How to read this document.** Plain statements are decisions Kingsley made. Anything marked **(my call)** is a choice Claude made to fill a gap. Kingsley can override any of those. Section 13 lists what is left to whoever builds it.

---

## Try it

From the Spec Board repo, until it is published (section 9 says why the commands look like this):

```
npm run specboard -- init <project path>
npm run board -- <project path>
```

`init` shows the actions runs may use and asks you to approve them. The project should be a git repo, as runs commit per subtask. `board` opens the board in your browser.

---

## 1. Intent: why this exists

Kingsley builds software solo with Claude Code. They tried GitHub Spec Kit and OpenSpec on OgaBook, a Lagos barber booking platform. Both tools work, but they show the state of the work in two places only: Markdown files in VS Code and terminal output. Knowing where a project stands means opening files or asking Claude "where are we?", and both get tedious.

They want **something interactive they can glance at and act on**: a visual board over the same kind of spec files. It should let them:

1. **See progress at a glance:** what's done, what's in flight, what's left.
2. **Read the specs Claude wrote** in a pleasant format, get an overview, and spot mistakes.
3. **Correct things in two ways:** edit a spec directly for small fixes, or hand bigger changes to Claude.
4. **Answer Claude's open questions** with real form inputs, not by editing Markdown.
5. **Start Claude on a task** from the board.

In short, it's **OpenSpec with a UI**. The underlying model stays the same: Claude creates and updates Markdown files in the repo, and a local app shows them as an interactive kanban board.

It also has to work as a **portfolio project for Kingsley's CV**. OgaBook is where the need came from, but it's on hold. The focus is building this tool, and the demo uses a sample project.

## 2. Goals, non-goals, anti-goals

### Goals
- A local board that shows every spec in a project as a card in kanban columns.
- **Two-way sync:** a change to a Markdown file shows up in the UI live, and a change in the UI is written back to the Markdown file. **No database.** The files in the project folder are the only source of truth.
- A set of Claude Code slash commands that create, update and maintain the files.
- A Run button that tells Claude to start working on a spec.
- Polished enough to show off: a clean UI, a good README with a GIF, tests, and an npm package.

### Non-goals (v1)
- Custom templates. The tool ships one fixed file format. **(my call, based on "except defining template")**
- Hosting, accounts, multiple users, or cloud sync. It's local and single-user.
- Compatibility with OpenSpec or Spec Kit, or importing from them. Kingsley decided: **the goal is building this tool**. Bringing over OgaBook's existing specs is out of scope.
- Supporting AI agents other than Claude Code.
- A desktop installer (Electron/Tauri). **(my call; a possible later wrapper)**
- Cloud version, Slack/Telegram integration, Git integration, and co-working. These are listed in [future-features.md](future-features.md).

### Anti-goals: it fails if...
- Reading progress on the board is **no easier** than reading the Markdown.
- The UI and the files ever **disagree**, or a UI edit **mangles** a file Claude or Kingsley wrote.
- A user has to learn a heavy process (Spec Kit's six phases) before the board is useful.

## 3. Prior art and positioning

| Tool | What it does | What's missing for Kingsley |
|---|---|---|
| OpenSpec | Markdown changes and tasks, terminal `view` | No UI. Checkboxes only. |
| GitHub Spec Kit | Rigid phases, many documents per feature | Heavy. No UI. |
| Backlog.md | Markdown tasks, web kanban, MCP | Kingsley tried it. It doesn't fit their workflow. |
| claude-kanban, local-kanban | Markdown kanban that runs `claude -p` | Kingsley tried them. Same verdict. |
| openspec-ui, spec-ui, specboard | Read-only OpenSpec dashboards | Read-only. No editing, no answering questions. |

**What makes this one different:** specs are the cards; open questions have real inputs that unblock Claude; each subtask has a log; there's a written project overview; references are editable; and `/correct-specs` fixes specs that have drifted from the code. Pitch it as "a sharper, interactive take on spec-driven development", not "the first of its kind".

## 4. How it fits together

There are three parts:

1. **File format:** Markdown in a folder inside the project repo (section 6).
2. **Claude commands:** a Claude Code plugin with slash commands and a skill that read and write those files (section 8).
3. **Board app:** a CLI that starts a local web server and opens the board in the browser. It watches the files and writes UI changes back to them (sections 5, 7, 9).

```
 Kingsley ──► Board (browser) ◄──WebSocket──► Local server ◄──watch/read/write──► Markdown files
                    │                              │                                   ▲
                    └──── Run button ─────────────►└── spawns `claude -p` ──► Claude ──┘ (via slash commands)
```

## 5. Screens (from Kingsley's sketch)

> **Visual design (approved by Kingsley; the source of truth for the look):** the Claude Design prototype at https://claude.ai/code/artifact/14704a5a-facf-4b7f-a52f-f5150f6cbe06. A copy is in [`docs/design/`](design/): `Spec Board.dc.html` (the clickable prototype plus a component sheet), `SpecCard.dc.html`, `Markdown.dc.html`, and the original `rough-sketch.png`. The brief it was made from is [`design-spec.md`](design-spec.md).
>
> **Key tokens from the design:**
> - Fonts: **Geist** and **Geist Mono**.
> - Colours: warm neutral greys with an **orange accent** (`oklch(0.63 0.18 42)`). Status colours: Doing is blue, Review is amber, Done is green, Blocked is pink-red.
> - Light and dark themes are both defined, as `--bg/--panel/--card/--line/--fg*/--accent*/--doing*/--review*/--done*/--block*` CSS variables. Lift them from the prototype as they are.
>
> **The design adds a few things on top of this document. Build them:**
> - The Review column header carries a "Needs you" label.
> - A card with a file problem gets an **"Ask Claude to fix"** button, which runs Claude to repair that spec file.
> - The project switcher has **"Open another project folder…"**.
> - New reference documents are created under **`docs/`** in the repo, not under `.specboard/references/`. **(my call: follow the design)**
> - The run-output panel has a **Dismiss** action.
> - When a spec has no open questions, no dependencies or no subtasks, it shows friendly empty-state lines.

Every screen has a top bar with **SPEC-BOARD**, a **Project Name ▾** dropdown, and **References** and **Overview** buttons. Detail views open as modals over the board.

### 5.1 Board
- Four columns: **To-do, Doing, Review, Done.**
- Each card shows: the spec ID (e.g. `T-123`), the title, a short description, and a **View** button.
- Cards also show **categories**, **urgency**, and **dependencies/dependents** (Kingsley's requirement).
  - **Categories** are free-text tags; a spec can have one or more. Each category gets a consistent colour automatically. **(my call on the details)**
  - **Urgency** has four levels: `low`, `normal` (the default), `high` and `urgent`. Cards in a column are sorted by urgency, then by ID. **(my call on the levels and sorting)**
  - **Dependencies/dependents** appear as a compact line, e.g. "needs T-101 · needed by T-108".
- A **filter bar** filters the board by category and urgency, with a "Blocked only" toggle. **(my call)**
- Extra badges on cards: a **Blocked** badge when open questions are unanswered or a dependency isn't done, and **subtask progress** (e.g. `3/7`). **(my call)**
- **+ Add new spec** button (bottom right in the sketch).
- Done specs can be **archived**, which hides them from the board while their files stay on disk. **(my call)**

### 5.2 Spec card detail (modal)
From top to bottom:
- **Header:** the ID, the title, a **▷ Run** button ("Tell your agent to start"), and a **status dropdown** in the top-right corner. (I'm reading the sketch's "TODO ▾" as that dropdown.) Urgency and categories can be edited here. `/create-spec` sets both, and the user can change them.
- **Spec** section: the description and the **Features** list, rendered nicely. An **Edit** button switches to a Markdown editor for that section. Saving writes it back to the file.
- **Open questions:** each question renders as the right input: yes/no checkboxes, a text box, a number box (and a single-choice list, **my call**). A **Save changes** button writes the answers into the file.
- **Dependencies and dependents:** the specs this one depends on and the specs that depend on it, each linked and showing its status. Kingsley asked for this, but it isn't in the sketch, so placement is up to the builder.
- **Subtasks:** a checkbox list. Kingsley can tick them too. Each subtask that has a log shows a **≡ Log** link that opens its log.
- **Blocked banner** (red/pink) at the bottom while anything is unanswered, e.g. "Blocked. Awaiting answers on: No. of versions".
- **Run output:** while Claude is running on this spec, a live view of its output. **(my call; needed for the Run button to be useful)**

### 5.3 Overview (modal)
- The project name and a **progress ring**, e.g. "2/10 Complete". The app counts this live from the files.
- A written description of the project.
- **Progress:** a written summary of what's done and what's left. Claude writes it with `/refresh-overview` and it's stored as a file.
- An **Export** button, which downloads the overview as a Markdown file. **(my call on the format)**

### 5.4 Reference documents (modal)
- Tabs for the project's standing documents: **CLAUDE.md, CONTEXT.md, RULES.md**, and so on, scrolling sideways when there are many.
- Each document is rendered, with an **Edit** button.
- **+ Add** either links an existing file in the repo or creates a new reference document. **(my call)**

### 5.5 Add new spec
**(my call; it's a button in the sketch, but its flow isn't defined)** A small form asks for a title and a rough description in plain words. It writes a draft spec into To-do. A "Have Claude write this up" action then runs `/create-spec` on it, and Claude fills in the features, questions and subtasks.

## 6. File format (starting point; the builder may refine it)

Everything lives in one folder at the project root. **(my call: `.specboard/`)**

```
.specboard/
  config.md            # project name + description; list of reference doc paths
  overview.md          # written by /refresh-overview
                       # reference docs are linked by path in config.md; new ones are created in docs/ (per the design)
  specs/
    T-001-booking-page/
      spec.md          # the spec card
      logs/
        1-create-scaffold.md
        2-second-task.md
    T-002-.../
  archive/             # archived spec folders are moved here
```

**`spec.md` (illustrative):**

```markdown
---
id: T-001
title: Booking page
status: todo            # todo | doing | review | done
urgency: normal         # low | normal | high | urgent
categories: [Frontend]
depends_on: [T-000]
created: 2026-11-07
updated: 2026-11-07
---

## Spec
Customers pick a barber, a service and a time slot...

## Features
- Barber picker
- Time-slot grid

## Open questions
- [ ] Q1 (yesno): Do you want an X button?
  > answer:
- [ ] Q2 (number): Enter number of versions
  > answer:

## Subtasks
- [x] 1. Create scaffold
- [x] 2. Second task
- [ ] 3. Third task
```

Rules:
- **Status** lives in front matter. Moving a card changes only that field.
- **Blocked** isn't a status. It's worked out from unanswered questions and unfinished dependencies.
- **Dependents** aren't stored. The app works them out from other specs' `depends_on`.
- **Subtask logs** are one file per subtask, numbered to match. Claude adds to them while it works: what it changed, which files, and any notes.
- IDs come from a counter. The app and `/create-spec` both pick the next free `T-NNN`.
- Files must stay easy for people to read and edit by hand. The parser has to tolerate small manual mistakes and flag them, not crash.

## 7. Two-way sync

- The server watches `.specboard/` (and linked reference files) and pushes changes to the browser over a WebSocket. An edit in VS Code or by Claude shows up on the board within about a second.
- **UI writes are surgical.** Ticking a box, saving an answer or changing a status edits only that part of the file. Everything else stays byte-for-byte the same: formatting, comments, extra sections.
- **Conflicts:** every UI write carries the version (hash) of the file it was based on. If the file changed on disk in the meantime, the write is refused, the UI reloads the latest version, and it tells the user. Nothing is silently overwritten.
- Section edits (the Edit buttons) replace only that section's Markdown.

## 8. Claude commands (Claude Code plugin)

Kingsley named these:

| Command | What it does |
|---|---|
| `/create-spec` | Turns an idea (or a draft from the board) into a full spec: description, features, open questions, subtasks, dependencies. |
| `/update-spec` | Changes an existing spec as instructed, e.g. bigger corrections Kingsley hands to Claude. |
| `/refresh-overview` | Rewrites `overview.md` from the current state of all specs. |
| `/refresh-logs` | Brings the subtask logs up to date from what was actually done (e.g. git history), for when logs were missed. |
| `/correct-specs` | Finds specs that no longer match the code (e.g. after manual edits) and fixes them. |

Added **(my call)**, because the Run button needs them:

| Command | What it does |
|---|---|
| `/run-spec <id>` | Works through a spec's subtasks. It sets status to Doing, ticks subtasks and writes their logs as it goes, and moves the card to **Review** when finished. If it hits an unanswered question it needs, it stops and leaves the spec blocked. |
| `/next` | Picks the next unblocked To-do spec and runs it. Optional. |

A **skill** ships with the commands. It teaches Claude the file format and the rules: always log per subtask, never edit outside `.specboard/` except for real code work, ask through open questions instead of guessing, and pick up answers saved on the board before continuing.

**One kit, delivered two ways.** The commands and the skill live in one folder in the package (`packages/server/kit`):
- **As a plugin, for board runs.** A run loads the kit with `--plugin-dir` and calls it as `/specboard:run-spec T-001`. A project can't change what a board run is told to do, because the run doesn't read the project's copy.
- **As project skills, for typed commands.** `specboard init` also copies the skills into `.claude/skills/`, so typing `/run-spec T-001` in your own Claude Code session works.

Board runs don't load `CLAUDE.md` by themselves, so every command tells Claude to read it.

### How a question round-trips
1. While running, Claude needs a decision. It adds an open question to `spec.md` and stops. The card shows **Blocked**.
2. Kingsley answers on the board and saves. The answer is written into the file.
3. Kingsley presses **Run** again (or runs `/run-spec`). Claude reads the answers and carries on.

A refused action is not a question. Claude stops and says what was refused, and the board shows the refusal with the rule to allow (section 9). An unanswered question there would stop the next run even after the rule was allowed.

## 9. Run button

- Pressing **▷ Run** on a spec makes the server start Claude Code in headless mode in the project folder. The output streams live onto the card. The command is built only from fixed strings and a checked spec ID:

  ```
  claude -p "/specboard:run-spec T-001" --output-format stream-json --verbose
    --permission-mode dontAsk --setting-sources "" --plugin-dir <kit>
    --settings {permissions, disableAllHooks: true}
  ```
- **One run at a time per project.** **(my call)** There's a **Stop** button.
- **A blocked spec or a draft doesn't start.** The button is off and says why, so no usage is spent on a run that would only explain it can't proceed. This is the board's check; the server would still start it.
- **Which `claude` runs:** the server looks it up itself, by absolute path, in the absolute PATH entries outside every registered project. Windows would otherwise try the current folder first, and a `claude.cmd` in a repo's root would run with your rights.
- **Which PATH a run gets:** relative, empty and `.` entries and folders inside any registered project are dropped, and the status check that runs when a project opens skips the same folders (a `claude` found only inside one reads as not installed). So a repo script calling a bare local `.cmd` from its own folder must use a relative path such as `.\gradlew`.
- **Where `init` refuses:** a folder holding `~/.specboard` (`init ~`, say), since a run could then edit its own permissions, and Spec Board's own repo. It warns, and carries on, if the folder has no `.git`, as runs commit per subtask.
- **Permissions (Kingsley's decision, Decision 1):** a headless run can't stop to ask for approval. So `specboard init` shows an **allow-list of actions** (edit files, run the project's tests, `git add`/`git commit`, and so on), Kingsley reviews it once, and the approved copy is stored **outside the repo**, in `~/.specboard/permissions.json`. Runs use only that copy, passed with `--settings`. Anything outside it is refused. A repo can't widen its own permissions by editing a file it controls. `init` also merges the list into `.claude/settings.json`, for typed commands and because the skill reads the test command from there, but a run's permissions never come from that file. The default list is conservative: no `git push`, no `git reset`, no `rm -rf`, and no writes to `.claude/` or `.git/`.
- **A refused action that stops the run:** the card shows what was refused and, where it is safe to offer, the rule to add: `specboard allow "Bash(npm config:*)"`. That command always asks at a terminal and has no `--yes`. After it, **Run** again gets past the refusal. Until Spec Board is published, `specboard` isn't on your PATH, so run both commands from the Spec Board repo: `npm run specboard -- init <project path>` and `npm run specboard -- allow "<rule>" <project path>`. Rules that meet the deny list, shells and wrappers, and file paths outside the project are not offered. If Claude was refused something but still finished the spec, the card goes to Review as normal, and the end card says how many actions were refused, so check the result before moving it to Done.
- **Runs are isolated (Kingsley's decision, Decision 2):** `--setting-sources ""` and `disableAllHooks` leave out the project's and the person's settings. A run does not get the project's hooks, its `.mcp.json` servers, or its `permissions.allow`, including a hostile `Bash(*)`. It does not get the person's plugins, MCP servers or hooks either. Only the approved list and the kit apply. `npm run test:claude` checks this with a real run against a hostile project.
- **What these limits don't cover. Read this before running a project you don't trust:**
  - **The allow-list is a guard rail, not a sandbox.** `npm test` and `git commit` run the repo's own code and its git hooks, with your user's full rights, so a hostile repo can do anything through them. Other inherent gaps: `git diff --no-index` and `--output` reach outside the project, and `.mcp.json` can be edited by a run. Only run projects whose tests you would be willing to run yourself.
  - **Repo text is still input to Claude.** A run reads `CLAUDE.md`, the specs and `.claude/settings.json`, so a repo can try to talk Claude into things. The permission list still decides what actually runs.
  - **Personal plugins and MCP servers are off during runs.** Your claude.ai connectors were still listed in isolated runs. They aren't on the allow-list, but whether a call to one would be refused was not tested.
  - **`env` and `apiKeyHelper` in your user settings don't reach isolated runs.** Confirmed on 2026-11-09 with Claude Code 2.1.302, one run each, using a throwaway `CLAUDE_CONFIG_DIR`: with `--setting-sources user` both took effect, with `--setting-sources ""` neither did. If you log in or reach a provider through those settings, set the variables in the environment the board starts from. Login with `claude` itself is not affected.
  - **A replaced folder at the same path keeps its approval.** If you delete a repo and clone another to the same path, it inherits the approved list, though it can't change that list. A link pointed somewhere else reads as "not approved". This is the same model as Claude Code's own trust dialog.
  - Not tested: a folder you have already trusted in Claude Code (`--setting-sources ""` is what is meant to rule that case out), and hooks in your own user settings (the machine tested has none). Also not verified: whether `--setting-sources ""` drops a `model` set in your user settings, so a run may use the default model instead.
  - Claude Code keeps its normal session records for a run under `~/.claude/`. Spec Board writes nothing there.
- If the `claude` CLI isn't found, Run falls back to **copying the command** so Kingsley can paste it into Claude Code.
- **Run uses the Claude Code CLI** (`claude -p`) with the user's existing login and subscription. It doesn't use the Agent SDK with an API key, so there's no key setup and no per-token bill. **(my call)**
- **Git during a run (my call):** the run works on the current branch and makes **one commit per subtask**, with a message like `T-001 · 2. Second task`. It creates no branches or worktrees in v1. Each subtask log lists that commit and the files it changed, so for **Review → Done**, Kingsley reads the logs and changed files on the card (and the diff in git if wanted). `/refresh-logs` uses these commits.
- **What `git status` shows after a run:** the code is committed, but the spec and its logs are not. A log records its own commit's hash, so it can't be part of that commit. Expect ` M .specboard/specs/T-001-.../spec.md` and `?? .specboard/specs/T-001-.../logs/`, and commit them yourself when you're happy. `specboard allow` also leaves `.claude/settings.json` modified.

## 10. Moving cards

**(my call)** Both Claude and the user can move cards:
- Claude moves cards as it works: To-do → Doing → Review.
- Kingsley drags cards or uses the status dropdown. Their main move is **Review → Done**, which means "I've checked it and approve it". Only a human moves a card to Done.
- Every move is written to the file's `status` field.

## 11. Several projects

**(my call, from the "Project Name ▾" dropdown)** Running the CLI inside a repo opens that repo's board and remembers it. The dropdown switches between remembered projects, e.g. OgaBook and later ones. The list of projects is a small JSON config file in the user's home folder. It isn't a database; specs stay in each repo.

## 12. Technology (my calls; the builder may adjust)

- **Distribution:** an npm package. `npx claude-spec-board` (in a repo) starts the server on a free local port and opens the browser. `init` creates `.specboard/` and installs the Claude Code plugin/commands.
- **Server:** Node + TypeScript, Hono or Express, chokidar for watching files, WebSocket for live updates.
- **Markdown:** gray-matter for front matter, and remark/unified (or a careful hand-written parser) for sections. **Round-trip safety matters more than anything else here.**
- **Board UI:** **React + Vite** (Kingsley's choice; a builder can suggest a better option, but Kingsley decides before it changes). The UI follows the Claude Design prototype in [`docs/design/`](design/) screen by screen: its layout, components, states, Geist fonts, and colour tokens for light and dark themes, copied as they are. Drag and drop uses a library (e.g. dnd-kit), and the Edit buttons use a simple Markdown editor.
- **Windows 11 is a first-class platform** (Kingsley develops on it), and macOS/Linux should work too.
- **Tests (Kingsley's choice: Vitest and Storybook):** **Vitest** for all unit and integration tests, and **Storybook** for the React components. Every component gets stories for each state shown in the prototype (card states, run states, empty states, light and dark), and Storybook's Vitest integration runs those stories as tests. Beyond that: unit tests for parsing and writing (especially "edit one thing, rest of the file unchanged"), integration tests for sync and conflicts, and a few end-to-end browser tests (Playwright) of the main flows.
- **Open source on GitHub (Kingsley's decision):** the project is open source, in a **public repository on Kingsley's GitHub account** (GitHub, not GitLab). CI runs on GitHub Actions. It ships with a LICENSE (MIT, **my call**), a CONTRIBUTING.md, and issue and pull-request templates.
- **Portfolio extras:** a README with a GIF and screenshots, a sample project to demo it, CI running the tests, and a published npm package.
- **Name:** "claude-spec-board" is only a working name. Using "Claude" in a third-party product name may break Anthropic's brand rules, so settle the final name (something like `spec-board`, worded as "for Claude Code") **before the publish milestone**. Renaming after publishing is costly. **(my call)**

## 13. Left to the builder

- The exact Markdown grammar, as long as section 6's rules hold.
- Folder and file naming details, the port, and how the CLI is laid out.
- The visual design, within the sketch's layout.
- ~~How headless Claude permissions are configured, documented clearly.~~ Settled in Milestone 3: an approved list outside the repo, and runs isolated from project and user settings (section 9).
- ~~Whether the Claude Code commands ship as a plugin, as `.claude/commands` files copied in by `init`, or both.~~ Settled in Milestone 3: both. The kit is a plugin for board runs and project skills for typed commands (section 8).
- How v1 is split into milestones. A sensible order: file format + parser → read-only board with live updates → UI edits written back → Claude commands → Run button → overview/references → polish and publish.
