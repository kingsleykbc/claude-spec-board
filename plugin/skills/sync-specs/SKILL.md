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
- No flags: you are in a chat. Work out the changes, show them, ask, and apply on an OK. No proposal file is needed.
- Without `--board`, `--dry-run` only shows the changes, and `--apply` applies an existing proposal file as below.

## What sync may change

Read the specs (and their logs) in scope, `git log` and the code they describe. Propose only what the evidence shows:
- subtasks to tick, naming the commit or code that shows them done; untick only with clear evidence the work was removed;
- status moves: `todo` to `doing`, or to `review` when Claude's subtasks are done. Never set `status: done`;
- new specs for clear work in the code that has no card: drafts, or `review` when the work is finished (whole-project sync only), placed in a milestone when the project has them;
- specs that no longer match anything, to archive.

Sync never deletes a spec file or a log, never deletes or rewrites a log entry, and never changes `created`. When it unticks a subtask, archives a spec, or finds a log whose work no longer exists, the proposal also marks that log obsolete: on apply, add `obsolete: "<YYYY-MM-DD>: <short reason>"` to the log's front matter and a dated entry `Marked obsolete by sync: <reason>`.

Sync does not move spec folders. An archive is done by the person with the Archive button on the board: sync marks the logs as above and lists the spec to archive in its summary.

## The proposal

Make a summary (one line per spec that changes), the tree with `+`, `~` and `→` marks (see "Proposing changes" in the rules; with an ID, just that spec), and a numbered list of exact operations, one per line, for example:

```
1. Tick T-104 subtask 2 (commit a1b2c3d)
2. Untick T-104 subtask 3 (the export code was removed in f00ba12)
3. Move T-106 to review
4. Mark obsolete: T-090 log 2 (the CSV export was removed)
5. Archive T-090 (on the board, by you)
6. Create draft: Recipe ratings in Sharing
```

If nothing needs changing, say "The board already matches the code." and stop without writing a file.

The proposal file is `.specboard/sync-proposal.md`:

```
---
created: "YYYY-MM-DD HH:mm"
head: "<output of git rev-parse --short HEAD>"
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

Leave out `scope:` for a whole-project sync. Quote `created` and `head` as shown.

## --dry-run

With `--board`, write `.specboard/sync-proposal.md` and change no other file. In a chat, show the summary and the tree and change nothing. Finish with the summary.

## --apply

1. Read `.specboard/sync-proposal.md`. If it is missing, say "There is no sync proposal to apply." and stop.
2. Run `git rev-parse --short HEAD`. If it differs from `head`, change nothing and stop with: "The code changed since the proposal. Run Sync again."
3. If the proposal's `scope` differs from the ID you were given (one present and not the other, or two different IDs), change nothing and stop with: "This proposal is for a different scope. Run Sync again."
4. Apply exactly the listed operations, in order, with small Edit calls (Write for a new draft). Do nothing else. Set `updated` to today on every spec you change. A new draft follows "Writing a good spec" only as far as a draft does: front matter and a short `## Spec`.
5. The proposal is now used up. With `--board`, leave the file: background runs may not delete files, so the board deletes it when the run ends. In a chat, delete `.specboard/sync-proposal.md` with the Bash tool (the person approves it). It is the only file sync ever deletes.
6. Finish with what changed, and the specs the person should archive on the board.

## In a chat (no flags)

Show the summary and the tree, and ask for an OK or changes. On the OK, apply the operations as in `--apply` step 4 (no proposal file, no head check). Finish as in step 6.
