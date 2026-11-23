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
2. Remove open questions that the spec text now makes pointless. Never renumber existing questions; a new question gets the highest existing number plus one.
3. Remove a subtask only when it is not ticked, has no log, no longer makes sense, and every subtask after it is also unticked with no log. Otherwise keep it: logs are keyed by subtask number and numbers must run 1, 2, 3 with no gaps. Renumber the unticked subtasks after a removed one so the numbers stay in order. If `current_subtask` points at a subtask whose number changed, set it to the new number.
4. Add only the questions, subtasks and `## To review` items the new text needs, in the format from the rules. New subtasks go after the last existing one. A check the person does after the work is a To review item, not a `(you)` subtask. Remove an unticked To review item only when the new text makes it pointless.
5. Never reword a question, subtask or To review item that still fits. Never touch ticked subtasks, ticked To review items, logs, or answered questions that still apply. Never drop the `## To review` section.
6. Remove the `needs_refresh` line from the front matter and set `updated` to today. Change nothing else in the front matter, except `current_subtask` as step 3 says.
7. Finish with one line saying what changed, e.g. "Removed Q3 and subtask 4, added Q6." or "Nothing needed changing."
