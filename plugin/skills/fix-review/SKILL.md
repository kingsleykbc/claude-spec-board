---
name: fix-review
description: Fix the To review checks the person marked as failed on a card in Review, as new subtasks, then send the card back to Review. Usage /fix-review <ID>
disable-model-invocation: true
argument-hint: <ID>
---

Before anything else, load the `specboard` skill with the Skill tool (it may be listed as `specboard:specboard`) and follow it. It holds the file format and the rules for this command. If it cannot be loaded, say so and stop.

If the project has a `CLAUDE.md`, Read it first and follow it, except where it conflicts with these rules.

Input: $ARGUMENTS

The first word is the spec ID. If the input ends with `--board`, the board started you and no one is in the chat: ask nothing in the chat.

A failed item is a `## To review` item with a `  > failed: <reason>` line. The person wrote the reason with the board's Fail button.

## Steps

1. Read `.specboard/specs/<ID>-*/spec.md`, its logs, its images (the linked ones and the attachments) and `.specboard/config.md`. Stop and say so if the spec does not exist. Find the failed items. If no item has failed, say so and stop. If a required open question is unanswered, list it and stop, as Running a spec does.
2. For each failed item, decide what it is:
   - a bug: the work does not match the spec. The spec stays as it is.
   - a change of mind: the person now wants something different (for example "make it blue, not red"). First update `## Features` and `## Done when` to match, with small Edit calls.
   - In a chat, when it is unclear which one it is or what the person wants, ask, one question at a time, each with a suggestion. Wait for each answer.
   - In a background run (`--board`), when it is unclear, add a required open question and stop without changing code. Use the question format in the rules, set `current_subtask: null` and leave the status as it is.
3. Append one subtask per failed item at the end of `## Subtasks`, numbered on from the last one: `Fix: <reason, shortened> (review item <n>)`, where `<n>` is the item's position in `## To review` (1 for the first item). Never renumber existing subtasks. Leave out a failed item that already has an unticked `Fix:` subtask, and use that one.
4. Set `status: doing` and `updated` to today. Run those subtasks exactly as step 4 of "Running a spec" in the rules says: `current_subtask`, the tests from `test_command`, one commit per subtask, its log and the tick.
5. After each fix is done, replace that item's `> failed: <reason>` line with `> fixed: <reason> (<commit>)`, indented the same, using the short hash of the fix commit, or `no commit` when there was none. Keep the item's other lines as they are. Leave the item unticked for the person to check again. Never tick To review items.
6. End as a normal run ends (step 6 of "Running a spec"): check `## Done when`, then set `current_subtask: null`, `status: review` and `updated` to today. With `specs_in_git: true`, make the board commit `Spec Board: <ID> to Review` (see Specs in git in the rules). Never set `status: done`.
7. Finish with a short summary: each failed check, whether it was a bug or a change of mind, what you changed, and the commits. Say the items are ready to check again.
