---
name: specboard
description: Spec Board file format and working rules. Use whenever you read, create or edit anything under .specboard/ (specs, subtask logs, overview, config), or work through a spec's subtasks.
---

# Spec Board: file format and rules

Spec Board is a kanban board over plain Markdown files in `.specboard/`. People and Claude edit the same files, so keep them easy to read and keep the grammar below exactly.

## Layout

```
.specboard/
  config.md                     # front matter: name, references (list of repo-relative paths); body = project description
  overview.md                   # front matter: updated (YYYY-MM-DD); body = progress summary
  specs/<ID>-<slug>/spec.md
  specs/<ID>-<slug>/logs/<n>-<slug>.md
  archive/<ID>-<slug>/...       # archived specs, same layout
```

- `<ID>` is `T-` plus at least three digits (`T-001`). The next free ID is one more than the highest number in `.specboard/specs/` and `.specboard/archive/` (use Glob to list them).
- `<slug>` is the title in lowercase ASCII `[a-z0-9-]`, at most 40 characters. If nothing is left, use `spec`.
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
| `created`, `updated` | `YYYY-MM-DD` |

Body sections, matched case-insensitively: `## Spec`, `## Features`, `## Open questions`, `## Subtasks`. Any other section is kept untouched.

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

## Open questions
- [ ] Q1 (yesno): Should customers be able to cancel a booking?
  > answer:
- [x] Q2 (number): How many days ahead can a customer book?
  > answer: 14
- [ ] Q3 (choice: Email | SMS | Both): How should customers be reminded?
  > answer:
- [ ] Q4 (text): Any wording for the confirmation screen?
  > answer:

## Subtasks
- [x] 1. Create the page scaffold
- [ ] 2. Build the time-slot grid
- [ ] 3. Wire up confirmation
```

Question line: `- [ ] Q<k> (<type>): <text>`, then an indented line `  > answer: <value>`.
- `type` is `yesno`, `number`, `text` or `choice`. A `choice` lists its options after a colon, separated by `|`: `(choice: A | B | C)`.
- A question is answered when its answer value is not empty. The box is `[x]` when answered, `[ ]` otherwise. Question numbers `k` are never reused: a new question gets the highest existing number plus one.
- To add a question, append it at the end of `## Open questions` (add that section if it is missing).

Subtask line: `- [ ] <n>. <title>`, and `- [x] <n>. <title>` when done. Numbers run 1, 2, 3 in order.

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

- `commit` is the short hash of the subtask's commit (empty if there is none), and `files` lists the files that commit changed.
- Each entry is headed `### YYYY-MM-DD HH:mm`, followed by free text on what changed and any notes. Add a new entry to an existing log instead of replacing it.

## Blocked

"Blocked" is not a status. A spec is blocked when it has any unanswered question, or when a spec in `depends_on` is not finished (its `status` is not `done` and it is not in `.specboard/archive/`), or when a `depends_on` ID does not exist.

## Rules

1. Never set `status: done`. Only a person moves a card to Done. When all subtasks are finished, set `status: review`.
2. Never guess. When you need a decision that the spec does not give you, add an open question and stop. Do not continue on an assumption. When you start, read the answers already saved on the board and use them.
3. Use the Bash tool for git and for the project's tests, and for nothing else (the test command goes on its own, not chained with other commands, and you do not run ad-hoc scripts). Do not use the PowerShell tool. Read and list files with Read, Glob and Grep, never with `cat`, `ls` or `find` in Bash.
4. Never run `git push`. Never create branches or worktrees. Never rewrite history (`reset`, `rebase`, `commit --amend`).
5. Edit `.specboard/` only for spec bookkeeping, plus the code the spec needs. Never edit anything under `.claude/`. Never touch files outside the project folder.
6. Work with the file tools: Read, Edit, Write, Glob and Grep. Do not use shell commands such as `rm`, `mv`, `mkdir` or `echo` for files. Change a spec with small Edit calls so everything else in the file stays exactly as it was (comments, other sections, line endings). Do not rewrite a whole file just to change one line.
7. Dates are `YYYY-MM-DD`. Take today's date from your context. If you do not have it, read it from the last commit: `git log -1 --format=%cd --date=format:"%Y-%m-%d %H:%M"`.
8. If a tool call is refused (permission denied), do not look for a way around the refusal. If you only used the wrong tool (for example Bash to read a file), use the right one. If the action itself is needed (a commit, the tests, a file outside the project), add an open question that says which action you needed, and stop.
9. When something is unclear or the files do not match this format, say so in your answer and stop. Do not "fix" the format by inventing new keys.
