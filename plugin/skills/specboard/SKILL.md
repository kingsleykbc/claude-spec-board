---
name: specboard
description: Spec Board file format and working rules. Use whenever you read, create or edit anything under .specboard/ (specs, subtask logs, overview, config), work through a spec's subtasks, or archive a spec.
---

# Spec Board: file format and rules

Spec Board is a kanban board over plain Markdown files in `.specboard/`. People and Claude edit the same files, so keep them easy to read and keep the grammar below exactly.

## Layout

```
.specboard/
  config.md                     # front matter: name, created (YYYY-MM-DD), references (list of repo-relative paths to `.md` files inside the project), closing_steps and milestones (lists, optional), commits (true or false, optional), specs_in_git (true or false, optional; see Specs in git) and test_command (a command string, optional); body = project description, then optional ## Stack and ## Design sections
  overview.md                   # front matter: updated (YYYY-MM-DD); body = progress summary, then an optional `## Out of sync` section (written by refresh-overview, removed by a project-wide sync)
  settings.md                   # optional, front matter only: track_tokens (true or false); the person sets it on the board
  specs/<ID>-<slug>/spec.md
  specs/<ID>-<slug>/logs/<n>-<slug>.md
  specs/<ID>-<slug>/images/<name>.png   # the spec's pictures (png, jpg, gif, webp, svg, avif)
  archive/<ID>-<slug>/...       # archived specs, same layout
  sync-proposal.md              # only between the two steps of a board sync (see /sync-specs)
  imported/<source-name>/...    # old plan files moved here by setup; the board ignores them
```

- `<ID>` is `T-` plus at least three digits (`T-001`). The next free ID is one more than the highest number in `.specboard/specs/` and `.specboard/archive/` (use Glob to list them).
- `<slug>` is the title in lowercase ASCII `[a-z0-9-]`, at most 40 characters. If nothing is left, use `spec`.
- Put a spec's images in its `images/` subfolder and link them relatively in the Markdown, e.g. `![Login screen](images/login.png)`. The board shows them in the spec.
- Images in `images/` that the spec text does not link are **attachments**: pictures the person added on the board for Claude to look at. The board shows them in their own Attachments section.
- When you work on a spec (write it up, change it, run it), Read every image its text links and every attachment in its `images/` folder (Glob `images/*`). They are part of what the person asked for.
- Writing a file with the Write tool creates its folders, so you never need to create a folder yourself.

## spec.md

Front matter keys:

| Key | Value |
|---|---|
| `id` | `T-001` |
| `title` | short title |
| `status` | `todo`, `doing` or `review` (the card's column; see the rules below) |
| `urgency` | `low`, `normal`, `high` or `urgent` |
| `categories` | list of strings, for example `[Frontend]` |
| `depends_on` | list of spec IDs, for example `[T-000]` |
| `draft` | `true` while the spec is only a rough idea; `false` (or absent) once written up |
| `current_subtask` | the number being worked on right now, or `null` |
| `milestone` | optional; one name from `milestones` in config.md (see Milestones) |
| `created`, `updated` | `YYYY-MM-DD`; set `updated` to today on every edit, never change `created` |
| `needs_refresh` | `YYYY-MM-DD`; set by the board after a body edit in To-do or Doing. Only /refresh-questions removes it. Never set it yourself |

Body sections, matched case-insensitively: `## Spec`, `## Features`, `## Done when`, `## Open questions`, `## Subtasks`, `## To review`. Any other section is kept untouched.

Complete example (this is exactly the grammar the board's parser accepts):

```spec
---
id: T-001
title: Booking page
status: todo
urgency: normal
categories: [Frontend]
depends_on: [T-000]
draft: false
current_subtask: null
created: 2026-11-07
updated: 2026-11-07
---

## Spec
Customers pick a barber, a service and a time slot, then confirm.

## Features
- Barber picker
- Time-slot grid

## Done when
- A customer can book a slot and sees the confirmation.
- A taken slot cannot be booked twice.

## Open questions
- [ ] Q1 (yesno): Should customers be able to cancel a booking? (recommended: Yes)
  > answer:
- [x] Q2 (number): How many days ahead can a customer book? (recommended: 14)
  > answer: 14
- [ ] Q3 (optional choice: Email | SMS | Both): How should customers be reminded? (recommended: Email)
  > answer:
- [ ] Q4 (text): Any wording for the confirmation screen?
  > answer:

## Subtasks
- [x] 1. Create the page scaffold
- [ ] 2. Build the time-slot grid
- [ ] 3. Wire up confirmation

## To review
- [ ] Book a slot on your phone
  > step: Run `npm run dev` in the project folder.
  > step: On your phone, open http://<your computer's IP>:5173/book.
  > step: Pick a barber, a service and a free slot, then tap **Confirm**.
  > expected: The confirmation shows the barber, the service and the time.
- [ ] Try to book the same slot again
  > step: Go back to http://<your computer's IP>:5173/book and pick the same slot.
  > expected: The slot shows as taken.
```

Question line: `- [ ] Q<k> (<type>): <text>`, then an indented line `  > answer: <value>`.
- `type` is `yesno`, `number`, `text` or `choice`. A `choice` lists its options after a colon, separated by `|`: `(choice: A | B | C)`.
- A question is **required** unless the word `optional` comes before its type: `(optional yesno)`, `(optional choice: A | B)`. Make it required when the work can't go ahead without the person's decision. Make it optional when there is a sensible default and a wrong guess is cheap to change. An optional question must have a recommendation.
- End a question with `(recommended: <value>)` whenever you have a view, and always on an optional question. Say what you would pick; for a `choice` or `yesno` use one of its options.
- A question is answered when its answer value is not empty. The box is `[x]` when answered, `[ ]` otherwise. Question numbers `k` are never reused: a new question gets the highest existing number plus one.
- To add a question, append it at the end of `## Open questions` (add that section if it is missing).

Subtask line: `- [ ] <n>. <title>`, and `- [x] <n>. <title>` when done. Numbers run 1, 2, 3 in order.

A subtask whose title starts with `(you) ` is for the person, not Claude: `- [ ] 1. (you) Add the API key to .env`. Use it only for something the person must do before or during the work. Claude never ticks a `(you)` subtask. The person ticks it on the board. A `(you)` subtask has no commit and needs no log. Use a `(you)` subtask for something the person does, and an open question for a decision.

`## To review` comes after `## Subtasks` and lists the checks the person does once the work is done. They go here, not as `(you)` subtasks at the end. Grammar:

```
## To review
### Adding tasks
- [ ] Add a task with the Enter key
  > step: Run `npm run dev` and wait for "ready".
  > step: Open [http://localhost:5173](http://localhost:5173).
  > step: Type "Buy milk" in the **New task** box and press Enter.
  > expected: It appears at the bottom of the list and the box clears.
- [ ] Reload the page
  > step: Press the browser's reload button.
  > expected: The task is still there.
```

- An item is `- [ ] <text>` at the start of a line (`- [x]` once checked), with no number. Indented lines may follow it, in any order:
  - `  > expected: <what they should see>`: at most one.
  - `  > step: <one step>`: any number, in order. Together they are the item's "How to check" steps on the board. Setup first (which command starts the app, seed data, a test account), then the real link to open, then where to click. Inline Markdown is allowed (links, `code`).
  - `  > failed: <reason>`: at most one. The person's check failed. Only the board writes `> failed:` (its Fail button); Pass or a tick removes it.
  - `  > fixed: <reason> (<commit or "no commit">)`: any number. The history Claude writes after fixing a failed check (see /fix-review).
  - Keep any other indented `>` line as it is.
- Optional `### <group>` headings group the items below them.
- A small spec has 1 to 3 plain items. A larger spec has groups of steps, each with an `expected` line.
- The person ticks them on the board. Claude never ticks a To review item. They do not count as subtasks and do not move the card.
- Never tick a To review item, and never remove or reword a `> failed:` or `> fixed:` line, except as /fix-review says.
- When the person asks in a chat to fix a card's review issues (its failed checks), Read and follow `../fix-review/SKILL.md` (relative to this skill's base directory) for that card.
- Never drop the section or its ticks when you change a spec.
- Older specs may still end with `(you)` check subtasks. Leave them as they are; they still work.

`## Done when` is 2 to 5 plain checks of what the person will see or be able to do. Each line is a result, not a piece of work. It is an ordinary section, so the board shows it as part of the spec.

`closing_steps` in config.md is an optional list of subtasks every spec in the project ends with, for example `closing_steps: [Write tests, Update the docs]`. Edit it by hand or leave it out.

## Writing a good spec

1. The first sentence of `## Spec` explains the whole spec on its own. The card shows only the start of it.
2. `## Done when` has 2 to 5 observable checks. Prefer checks a test or the code can prove. Something only a person can check (on a phone, in a browser) becomes a `## To review` item instead.
3. Keep subtasks small: each one doable and checkable on its own, with one commit.
4. Subtask order: `(you)` steps needed before the work, then Claude's work, then the `closing_steps` from config.md in order. Leave a closing step out only when the spec plainly does not need it (a docs-only spec needs no "Write tests"), and say so.
5. Put each `(you)` subtask where it is needed: before the work, or before the step that needs it. Checks the person does afterwards go in `## To review`, never as `(you)` subtasks at the end.
6. Ask a question only for a real decision, with a recommendation when you have a view. Do not ask what the spec or the code already answers.
7. Every To review item gets `> step:` lines, then its `> expected:` line. Setup first, with the project's real commands (the `test_command`, the start script in `package.json`, and so on), then the real URL and port from the code, then where to click. Short steps, plain words. The person should not have to guess how to start or reach anything.

## Spec or subtask?

- A **spec** is a result the person would want to follow as its own card: it changes what someone can see or do, has its own "Done when", can be reviewed on its own, and takes several sittings (about 2 to 8 subtasks).
- A **subtask** is one step toward a spec: one commit, one sitting, not worth reviewing alone.
- A **milestone** is a set of specs that ship together.
- Signs to split a spec: more than about 8 subtasks, Done-when lines about unrelated things, or parts that could ship apart.
- Signs to merge: a spec with one subtask, or two specs that cannot be reviewed apart.

Examples (a recipe app):
- "Meal planner calendar" is a spec: people see it and can review it. "Drag a recipe onto a day" is one of its subtasks.
- "Add a loading spinner to the recipe grid" is a subtask of "Recipe list page", not a spec: one commit, nothing to review alone.
- "User accounts" with sign up, sign in, sessions and password reset emails is close to the limit: password reset could ship later, so it can be its own spec.

## Milestones

Larger projects group specs into milestones: Project › Milestone › Spec › Subtask. Small projects have none and never need to think about them.

- `milestones: [Basics, Sharing, Polish]` in config.md lists them in order. The project has milestones when this list is not empty.
- `milestone: Basics` in a spec's front matter puts it in one. A spec with no milestone, or a name not in the list, shows under "No milestone". Use only names from the list.
- Specs can depend on specs in other milestones as usual (`depends_on`).
- The **current milestone** is the first in the list with a spec that is not done; if all are done, the last one.
- To rename a milestone, change the list and every spec that uses the old name. Reordering means reordering the list.

## Proposing changes

Before writing more than one spec, or changing several specs or the milestones, show the result as a tree and wait for an OK or changes. One new spec needs no tree.

The tree goes in a code block. Spec lines carry ID, title, status and `(draft)` when drafted, then the first sentence of `## Spec` cut to about 70 characters. Subtasks show a tick (`✓` done, `○` not). Milestones show done/total, in list order, with "No milestone" last. Without milestones there is no milestone level.

Mark proposed changes: `+` new, `~` changed, and `→ <where>` at the end of an item that moves away (`→ Sharing`, `→ archive`). Counts are for the result. A proposal may leave out the subtasks of specs it does not change.

```
Recipe Box · 1/4 done
├─ Milestone: Basics · 1/2
│  ├─ T-101 Recipe list page · done
│  │    A grid of saved recipes with photo, cook time and tags.
│  ├─ ~ T-104 Meal planner calendar · doing
│  │    A weekly calendar where recipes can be dragged onto days.
│  │    ├─ ✓ 1. Calendar layout
│  │    ├─ ✓ 2. Drag and drop
│  │    └─ + ○ 3. Week navigation
│  └─ T-108 Share recipe link · todo → Sharing
└─ + Milestone: Sharing · 0/2
   └─ + T-109 Recipe ratings · todo (draft)
        Let people rate a recipe from one to five stars.
```

- Get the current tree with `specboard tree [--spec <ID>] [--milestone <name>] [<project folder>]` and build the proposal on it. If that command is missing or refused, build the tree from the files by the rules above: the first line is `<name> · <done>/<total> done` (an archived spec that was in the Done column counts in both numbers; other archived specs count in neither), a `(you) ` subtask shows as `you: <title>`, and archived specs are not listed.
- In plan mode, put the tree and the list of files you will write or change in the plan, and write nothing until the plan is approved.

## Logs: logs/<n>-<slug>.md

One file per subtask, numbered to match, with the slug taken from the subtask title:

```log
---
subtask: 2
commit: a1b2c3d
files: [src/slots.ts, src/slots.test.ts]
---

### 2026-11-08 14:32
Built the time-slot grid. Slots come from the barber's opening hours. Tests added for the empty day.
```

- `commit` is the short hash of the subtask's commit. It is empty when there is no commit (`commits: false` or no git repo); then `files` lists the files changed for that subtask and there is no `pr`. Otherwise `files` lists the files that commit changed.
- `pr: <url>` (optional) links the open pull or merge request for the commit's branch. After the commit, Read the repo's `.git/config` (in the project folder or the parent that holds `.git`): only when it has a `github.com` remote, try `gh pr view --json url -q .url`; only when it has a `gitlab` remote, try `glab mr view -F json` (take its `web_url`). With neither remote, do not run them. If the lookup fails or there is no PR, leave `pr:` out and say nothing. If you opened the PR yourself, use its link.
- `done_at: YYYY-MM-DD HH:mm` (local time) is written when the subtask is ticked.
- `obsolete: "<YYYY-MM-DD>: <reason>"` marks a log whose work no longer exists. Only sync sets it (see /sync-specs).
- Each entry is headed `### YYYY-MM-DD HH:mm`, followed by free text on what changed and any notes. Add a new entry to an existing log instead of replacing it. Never delete or rewrite an entry.
- `tokens:` is filled in automatically by Spec Board. Never write it yourself. The Spec Board plugin adds `tokens:` to a log right after you write it: Read the log again before editing it a second time, and never remove `tokens:`.

## Blocked

"Blocked" is not a status. A spec is blocked when it has any unanswered required question, or when a spec in `depends_on` is not finished (its `status` is not `done` and it is not in `.specboard/archive/`), or when a `depends_on` ID does not exist.

## Archiving

Archive a spec only when the person asks (for example "archive T-002") or has said OK to a change that archives it. Run `specboard archive <ID> "<project folder>"` on its own with the Bash tool (always pass the project folder). It moves the spec to `.specboard/archive/`, the same as Archive on the board; an archived spec no longer blocks the specs that depend on it. Never move spec folders yourself. If it fails for any reason, tell the person to use Archive in the card's ⋯ menu on the board.

To carry a card's images to another card (a merge or a split), run `specboard copy-images <from ID> <to ID> "<project folder>"`: it copies every image from the first card's `images/` into the second's, never overwriting, and prints `images/<old> -> images/<new>` per file.

## Specs in git

`specs_in_git` in config.md says whether `.specboard/` is kept in git. It is chosen at setup.

- `true`: Claude keeps the specs in git, in their own commits. Code commits still never hold `.specboard/` files. When `commits` is not `false` and there is a git repo, end each of these with one board commit, but only if `.specboard/` changed:
  - a run that ends with the spec in Review (step 6 of Running a spec), in a chat or a background run. Use the summary `<ID> to Review`.
  - plan-project, import-specs, setup, create-spec, sync-specs, reorganize, move and the refresh commands, when they wrote `.specboard/` in a chat.
- The board commit holds only `.specboard/`. Run `git add .specboard`, then `git commit -m "Spec Board: <short summary>" -- .specboard`, each on its own with the Bash tool. The `-- .specboard` part keeps anything else that is staged out of it. For example `Spec Board: T-001 to Review` or `Spec Board: first specs`.
- If the board commit is refused, skip it, say so in one line, and carry on. Never push it.
- `false`: the specs stay on this machine, and `.specboard/` is hidden from git. Make no board commits.
- Not set: make no board commits.

## Running a spec

Only when the user ran `/run-spec` or `/next`, or asked for it directly. Never start a spec on your own.

1. Find `.specboard/specs/<ID>-*/spec.md` (Glob) and read it, then its existing logs and its images (the linked ones and the attachments, see Layout). Say so and stop if there is no such spec, or if `status` is already `review` or `done` and all of Claude's subtasks (everything except trailing `(you)` steps in older specs) are ticked. Open `## To review` items never count as Claude's work. If the spec is in Review and a To review item has a `> failed:` line, point the person to `/fix-review <ID>` instead, and stop.
   - If `draft: true`: when the person asked in a chat to run or implement it, say it needs writing up first, Read `../create-spec/SKILL.md` (relative to this skill's base directory) and follow it (its questions are asked in the chat), then continue with the run in the same reply, without waiting for the request again. In a background run (the board started you, no one is in the chat), say it needs `/create-spec` first and stop.
2. **Refuse to start** (change nothing, say why, stop) when:
   - any required question under `## Open questions` is unanswered. List them with their numbers; or
   - a spec in `depends_on` is not finished, or does not exist. Name it.

   Otherwise read the saved answers and use them as decisions. For an unanswered optional question, go with its recommendation, leave the question unanswered, and say which you assumed in the log of the first subtask it affects. If it has no recommendation, use your best judgment and say so the same way.
3. Edit the front matter: `status: doing`, and `updated` to today.
4. For each unticked subtask, in order:
   1. If it is a `(you)` subtask and Claude subtasks come after it: set `current_subtask: null`, leave the status as `doing`, say exactly what the person needs to do, and **stop**. Never tick it. The person ticks it on the board and runs again. In an older spec, a `(you)` check with only `(you)` subtasks after it does not stop the run: go to step 6 of Running a spec (the Done when check).
   2. Set `current_subtask: <n>`.
   3. Do the work the subtask describes, using the Spec and Features sections and the answers.
   4. Run the project's tests. Read `test_command` from `.specboard/config.md` (for example `test_command: "npm test"`) and run exactly that command, alone, with the Bash tool. Do not pick another test command and do not chain anything onto it. If it fails, fix the cause. If you cannot, treat it as the decision step (step 5 of Running a spec) and do not commit failing work. If there is no `test_command`, skip the tests: do not run or add tests and do not edit `package.json` to create a test script; write "No test command is set up" in the subtask's log entry and carry on.
   5. Commit only this subtask's code with the Bash tool: `git add <the files you changed>`, then `git commit -m "<ID> · <n>. <subtask title>"`. Do not add `.specboard/` files to this code commit. With `specs_in_git: true` they get their own board commit when the spec reaches Review (see Specs in git). When config.md has `commits: false`, or there is no git repo (neither the folder nor a parent has `.git`), make no commit.
   6. Get the short hash and local time with `git log -1 --format="%h %cd" --date=format:"%Y-%m-%d %H:%M"`, the changed files with `git diff --name-only HEAD~1 HEAD`, and the PR link as the log format says. With no commit, there is no hash and no PR link: take the current local time (from your context if it has one, otherwise run `date "+%Y-%m-%d %H:%M"` on its own with the Bash tool) and list the files you changed for this subtask.
   7. Write `.specboard/specs/<ID>-<slug>/logs/<n>-<slug>.md` in the log format: `subtask`, `commit` (empty with no commit), `files`, `pr` (when found; never with no commit), `done_at` (the commit's time, or now with no commit), and a dated entry (`### YYYY-MM-DD HH:mm`) of what you did.
   8. Tick the subtask (`- [x]`) and set `updated`. If it is a `Fix: <reason> (review item <n>)` subtask from /fix-review, also replace that To review item's `> failed:` line with `> fixed:`, as step 5 of `../fix-review/SKILL.md` says.
5. When you reach a decision you cannot make from the spec and its answers (or tests cannot be fixed): add a required open question (`- [ ] Q<k> (<type>): <text>` then `  > answer:`, with a recommendation if you have one), set `current_subtask: null`, leave the status as `doing`, say what you need, and **stop**. Do not guess and do not carry on to the next subtask. A refused action is different: see rule 8.
6. When no Claude subtask is left unticked (only trailing `(you)` checks in an older spec, or nothing), check each line of `## Done when` before moving to Review:
   - Check it with the code, the tests or a command you may run. Write the result of each line in a log entry: met, not met, or in To review (when only a person can check it), and how you checked.
   - Write the results in the log of the last subtask done in this run (or, if none was done this run, as a new dated entry in the log of the last code subtask).
   - A line you checked and found not met: fix it and commit the fix as `<ID> · <n>. <title>` of the last code subtask (no commit when `commits: false` or there is no repo, as in the commit step above), adding a dated entry to its log; or add a required question (step 5) and stop. Do not move to Review.
   - A line you cannot check yourself goes to `## To review` as an item, with an `expected` line, unless an item there already covers it (add the section after `## Subtasks` if it is missing; in an older spec a trailing `(you)` check that covers it is enough). It does not block Review and is not a question.
   - Otherwise set `current_subtask: null`, `status: review` and `updated` to today, and list the open To review items (and any trailing `(you)` checks) in your summary. Never tick them. Never set `status: done`.
   - Then, with `specs_in_git: true`, make the board commit `Spec Board: <ID> to Review` (see Specs in git).
   - A spec without `## Done when` has nothing to check: go straight to Review.
7. Finish with a short summary: subtasks completed, commits made, anything the reviewer should look at.

## Rules

1. Never set `status: done`, except when the person runs /specboard:move. Only a person moves a card to Done. When all of Claude's subtasks (everything except trailing `(you)` steps) are finished, set `status: review`.
2. Never guess. When you need a decision that the spec does not give you, add an open question and stop. Do not continue on an assumption. When you start, read the answers already saved on the board and use them.
3. Use the Bash tool for git, for the project's tests, and for a command the spec's work names or plainly needs. Whether such a command may run is for the permission list to decide, not you: try it, on its own, not chained with other commands (rule 8 says what to do if it is refused). Do not run ad-hoc scripts. Do not use the PowerShell tool. Read and list files with Read, Glob and Grep, never with `cat`, `ls` or `find` in Bash.
4. Never run `git push`. Never create branches or worktrees. Never rewrite history (`reset`, `rebase`, `commit --amend`).
5. Edit `.specboard/` only for spec bookkeeping, plus the code the spec needs. Never edit anything under `.claude/`. Never touch files outside the project folder.
6. Work with the file tools: Read, Edit, Write, Glob and Grep. Do not use shell commands such as `rm`, `mv`, `mkdir` or `echo` for files. Change a spec with small Edit calls so everything else in the file stays exactly as it was (comments, other sections, line endings). Do not rewrite a whole file just to change one line.
7. Dates are `YYYY-MM-DD`. Take today's date from your context. If you do not have it, read it from the last commit: `git log -1 --format=%cd --date=format:"%Y-%m-%d %H:%M"`. Without git, run `date "+%Y-%m-%d %H:%M"` on its own with the Bash tool.
8. If a tool call is refused (permission denied), do not look for a way around the refusal. If you only used the wrong tool (for example Bash to read a file), use the right one. If the action itself is needed (a commit, the tests, a command the spec needs, a file outside the project): do not try another way, set `current_subtask: null`, leave the status as `doing`, say which action was refused, and stop. Do not add an open question for it: the board shows the refusal and how to allow it, and an unanswered question would stop the next run after the person has allowed it. Six exceptions are optional and simply skipped when refused: the PR link (`gh`, `glab`), `specboard tree`, `specboard archive` (then tell the person to use Archive in the card's ⋯ menu), `specboard copy-images` (then tell the person which images to move), `date` (then use today's date with the time `00:00`), and the board commit of Specs in git (then say in one line that it was skipped).
9. When something is unclear or the files do not match this format, say so in your answer and stop. Do not "fix" the format by inventing new keys.
