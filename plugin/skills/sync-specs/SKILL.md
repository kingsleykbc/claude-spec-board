---
name: sync-specs
description: Bring the board in line with the code. Compares specs and logs with the code and git history, shows the changes as a tree, and applies them after an OK. Usage /sync-specs [ID] [--board] [--dry-run | --apply]
disable-model-invocation: true
argument-hint: "[ID] [--board] [--dry-run | --apply]"
---

Before anything else, load the `specboard` skill with the Skill tool (it may be listed as `specboard:specboard`) and follow it. It holds the file format and the rules for this command. If it cannot be loaded, say so and stop.

If the project has a `CLAUDE.md`, Read it first and follow it, except where it conflicts with these rules.

Input: $ARGUMENTS

- A spec ID (`T-` and digits) limits the sync to that spec (its **scope**). Without one, the scope is the whole project.
- `--board`: the board started you and no one is in the chat. Then `--dry-run` writes the proposal file and stops; `--apply` applies the proposal file. With `--board` and neither, say so and stop.
- Without `--board` you are in a chat: see "In a chat" below. `--dry-run` and `--apply` are for the board only; ignore them in a chat.

## What sync may change

Read the specs (and their logs) in scope, `git log` and the code they describe. Propose only what the evidence shows:
- subtasks to tick, naming the commit or code that shows them done; untick only with clear evidence the work was removed;
- status moves: `todo` to `doing`, or to `review` when Claude's subtasks are done. Never set `status: done`;
- moving a card back, by this rule. For each unticked Claude subtask (not `(you)` ones), look for the work in the code and the git log, as for ticks:
  - when the work exists, propose the tick and keep the column;
  - otherwise, when the card sits in a column ahead of its work, move it to To-do (no Claude subtask is ticked) or to Doing (some are);
  - a card with no subtasks at all (for example a draft) in Review or Done, with no code for its `## Spec`, moves back to To-do;
  - never move back a card whose only subtasks are `(you)` steps, nor a Done card whose Claude subtasks are all ticked;
  - still never set `done`;
- new specs for clear work in the code that has no card: drafts, or `review` when the work is finished (whole-project sync only), placed in a milestone when the project has them;
- specs that no longer match anything, to archive.

Without a git repo, the evidence is the code only.

Sync never deletes a spec file or a log, never deletes or rewrites a log entry, and never changes `created`.
- A tick is like any tick: in the subtask's log write `done_at:` (now) and a dated entry `Ticked by sync: <evidence>`, creating the log in the log format if it is missing.
- When sync unticks a subtask, archives a spec, or finds a log whose work no longer exists, it marks that log obsolete: add `obsolete: "<YYYY-MM-DD>: <short reason>"` to the log's front matter and a dated entry `Marked obsolete by sync: <reason>`.
- Sync never ticks, unticks or drops `## To review` items: they are the person's, and open ones never hold a card back from Review. Keep every `> failed:` and `> fixed:` line as it is.
- Sync does not move spec folders itself. After a board apply, the board archives every spec named on an `Archive <ID>` line. In a chat, Claude runs `specboard archive <ID>` for those lines (see "In a chat").

## The proposal

Run `specboard tree` first (with the ID when there is one) and build the tree on its output, so the counts match the board. Make a summary (one line per spec that changes), the tree with `+`, `~` and `→` marks (see "Proposing changes" in the rules; with an ID, just that spec), and a numbered list of exact operations, one per line. Write `Archive <ID>` with the ID straight after the word. For example:

```
1. Tick T-104 subtask 2 (commit a1b2c3d)
2. Untick T-104 subtask 3 (the export code was removed in f00ba12)
3. Move T-106 to review
4. Mark obsolete: T-090 log 2 (the CSV export was removed)
5. Archive T-090 (the CSV export was removed)
6. Create draft: Recipe ratings in Sharing
7. Move T-107 back to todo (no code for subtasks 1-3)
```

## --board --dry-run

Write `.specboard/sync-proposal.md` and change no other file:

```
---
created: "YYYY-MM-DD HH:mm"
head: "<output of git log -1 --format=%h>"
scope: T-104
changes: <number of specs that change>
---

## Summary
...

## Tree
(the tree in a code block)

## Operations
1. ...
```

Without a git repo, write `head: "none"`. Leave out `scope:` for a whole-project sync. Quote `created` and `head` as shown. If nothing needs changing, still write the file, with `changes: 0`, the summary line "The board already matches the code." and no tree or operations. Finish with the summary.

## --board --apply

1. Read `.specboard/sync-proposal.md`. If it is missing, say "There is no sync proposal to apply." and stop.
2. If `head` is `none` or missing, skip the head check. Otherwise run `git log -1 --format=%h`; if it differs from `head`, change nothing (not even the proposal) and stop with: "The code changed since the proposal. Run Sync again."
3. If the proposal's `scope` differs from the ID you were given (one present and not the other, or two different IDs), change nothing (not even the proposal) and stop with: "This proposal is for a different scope. Run Sync again."
4. Apply exactly the listed operations, in order, with small Edit calls (Write for a new draft or log). Check each operation against the file as it is now: when it no longer fits (the subtask is already ticked, or the spec is already in that column), skip it and report it. Do nothing else. Set `updated` to today on every spec you change. A new draft has front matter and a short `## Spec`, like any draft. For an `Archive <ID>` line, change only that spec's logs as above: the board archives the spec.
5. For a project-wide sync (no `scope`), remove the `## Out of sync` section from `.specboard/overview.md`, if it has one: the heading and its text, up to the next `## ` heading or the end. Change nothing else in the overview. This way the board's out-of-sync warning doesn't outlive the fix. A sync of one spec leaves the overview alone.
6. Last, only once every operation is applied: add the line `applied: true` to the proposal's front matter with one Edit. The board archives the listed specs and reports the sync done only when it finds that line; it deletes the file when the run ends. Change nothing else in the proposal.
7. Finish with a short list of what changed.

## In a chat

Show the summary and the tree, and ask for an OK or changes. On the OK, apply the operations as in `--board --apply` step 4. There is no proposal file and no head check. After a project-wide sync, remove the `## Out of sync` section from `.specboard/overview.md` as in `--board --apply` step 5. Then, last, run `specboard archive <ID> "<project folder>"` for each `Archive <ID>` line (see Archiving in the rules). If that fails for any reason, tell the person to use Archive in the card's ⋯ menu. Finish with what changed, the specs archived, and any the person still needs to archive on the board.
