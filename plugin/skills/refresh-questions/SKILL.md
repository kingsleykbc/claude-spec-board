---
name: refresh-questions
description: After the spec text changed, remove open questions and unstarted subtasks it made pointless and add only the ones it needs. Usage /refresh-questions <id>
disable-model-invocation: true
argument-hint: <id>
---

Before anything else, load the `specboard` skill with the Skill tool (it may be listed as `specboard:specboard`) and follow it. It holds the file format and the rules for this command. If it cannot be loaded, say so and stop.

If the project has a `CLAUDE.md`, Read it first and follow it, except where it conflicts with these rules.

Input: $ARGUMENTS

The first word is the spec ID. If the input ends with `--board`, the board started you and no one is in the chat: ask nothing in the chat.

Keep this small. Change only what the new spec text makes wrong or missing.

## Steps

1. Read `.specboard/specs/<ID>-*/spec.md`, its logs and `.specboard/config.md`. Stop and say so if the spec does not exist.
2. Remove open questions that the spec text now makes pointless. Remove subtasks that are not ticked, have no log, and no longer make sense. Renumber only unticked subtasks without a log, so numbers still run 1, 2, 3. Question numbers are never reused.
3. Add only the questions and subtasks the new text needs, in the format from the rules.
4. Never reword a question or subtask that still fits. Never touch ticked subtasks, logs, or answered questions that still apply.
5. Remove the `needs_refresh` line from the front matter and set `updated` to today. Change nothing else in the front matter.
6. Finish with one line saying what changed, e.g. "Removed Q3 and subtask 4, added Q6." or "Nothing needed changing."
