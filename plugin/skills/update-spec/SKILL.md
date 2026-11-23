---
name: update-spec
description: Change an existing spec as instructed (rewrite sections, add or reorder subtasks, adjust questions or dependencies). Usage /update-spec <id> <instructions>
disable-model-invocation: true
argument-hint: <id> <instructions>
---

Before anything else, load the `specboard` skill with the Skill tool (it may be listed as `specboard:specboard`) and follow it. It holds the file format and the rules for this command. If it cannot be loaded, say so and stop.

If the project has a `CLAUDE.md`, Read it first and follow it, except where it conflicts with these rules.

Input: $ARGUMENTS

The first word is the spec ID. The rest are the instructions.

## Steps

1. Read `.specboard/specs/<ID>-*/spec.md`, its logs and its images (the linked ones and the attachments, see Layout in the rules). Stop and say so if the spec does not exist or no instructions were given.
2. Make exactly the changes the instructions ask for, with small Edit calls. Leave everything else as it was, including answers already given.
3. Keep the file valid:
   - Subtasks stay numbered 1, 2, 3 in order. A subtask that is already ticked, or that has a log, keeps its number and title unless the instructions say otherwise. Add new subtasks at the end or renumber only unticked ones.
   - Existing questions keep their numbers. New ones get the next free number with an empty `  > answer:` line.
   - Keep `## To review` and its ticks; never tick an item yourself. A new check the person does after the work goes there as an item, not as a `(you)` subtask at the end.
   - If a change makes a ticked subtask's work wrong, add a new unticked subtask for the fix instead of unticking history, unless told otherwise.
   - Images go in the spec's `images/` subfolder, linked relatively, e.g. `![Login screen](images/login.png)`.
4. Set `updated` to today. Do not change `status` (never set `done`).
5. If the instructions are unclear or conflict with the spec, add an open question instead of guessing.
6. Finish with a short list of what you changed.
