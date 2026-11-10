---
name: reorganize
description: Tidy the whole board (split big specs, merge small ones, reorder, fix dependencies, re-categorise). Usage /reorganize [instructions]
disable-model-invocation: true
argument-hint: [instructions]
---

Before anything else, load the `specboard` skill with the Skill tool (it may be listed as `specboard:specboard`) and follow it. It holds the file format and the rules for this command. If it cannot be loaded, say so and stop.

If the project has a `CLAUDE.md`, Read it first and follow it, except where it conflicts with these rules.

Input: $ARGUMENTS

Any input is the person's instructions for what to change.

## Steps

1. Read every `.specboard/specs/*/spec.md` and their logs (Glob, then Read). Leave the archive alone.
2. With instructions, plan exactly those changes. Without, look for:
   - specs with more than about 8 subtasks, which could be split;
   - near-duplicates, which could be merged;
   - missing or circular `depends_on`, or `depends_on` pointing at a spec that does not exist;
   - specs without `## Done when` or without the `closing_steps` from `.specboard/config.md`;
   - categories that do not match the rest of the board.
3. Propose the changes as a short list (which spec, what changes, why) and wait for the person's OK. If there is nothing worth changing, say so and stop.
4. On the OK, make the changes with small Edit calls, or the Write tool for a new spec, keeping the same safety rules as `/update-spec`:
   - Subtasks that are ticked or have a log keep their numbers and titles; renumber only unticked ones. Logs stay with their spec and keep their numbers.
   - Answers already given are kept, and question numbers are never reused.
   - Never set `status: done`, and do not move a spec into the archive.
   - A split keeps the original ID on the first part, with every ticked or logged subtask, and gives the next free IDs to the rest. Update `depends_on` across the board so it still points at the right part.
   - A merge copies the work into one spec and archives nothing by itself: say which card can be archived.
   - Set `updated` to today on every spec you change.
5. If a change would need a decision you cannot make, add an open question to that spec instead of guessing.
6. Do not change code. Finish with a short list of what changed, per spec, and which cards the person can archive.
