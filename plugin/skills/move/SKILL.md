---
name: move
description: Move a spec to another column (To-do, Doing, Review, Done). Usage /move <id> <column>
disable-model-invocation: true
argument-hint: <id> <column>
---

Before anything else, load the `specboard` skill with the Skill tool (it may be listed as `specboard:specboard`) and follow it. It holds the file format and the rules for this command. If it cannot be loaded, say so and stop.

If the project has a `CLAUDE.md`, Read it first and follow it, except where it conflicts with these rules.

Input: $ARGUMENTS

The first word is the spec ID. The second is the column: To-do, Doing, Review or Done.

## Steps

1. Read `.specboard/specs/<ID>-*/spec.md`. Stop and say so if the spec does not exist, or if the column is missing or is not one of the four.
2. Map the column, without regard to case, to a status: To-do is `todo`, Doing is `doing`, Review is `review`, Done is `done`. This is the person's own request, so setting `done` here is allowed.
3. If the spec is already in that column, say so and stop.
4. Warn, and still move, in these cases:
   - the new column is Review or Done and the spec has unticked Claude subtasks (not `(you)` ones): name how many;
   - the spec is a draft (`draft: true`).
5. Change only `status` and `updated` (to today), with one Edit. Change nothing else: not the ticks, the subtasks, `current_subtask` or the logs.
6. Finish with one line, for example `T-104 moved from Doing to Review.`, followed by any warning.
