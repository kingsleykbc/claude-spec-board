---
name: correct-specs
description: Find specs that no longer match the code (for example after manual edits) and fix them. Usage /correct-specs [id]
disable-model-invocation: true
argument-hint: [id]
---

Before anything else, load the `specboard` skill with the Skill tool (it may be listed as `specboard:specboard`) and follow it. It holds the file format and the rules for this command. If it cannot be loaded, say so and stop.

Limit to this spec if an ID is given, otherwise check every spec that is not in the archive: $ARGUMENTS

## Steps

1. Read each spec and compare it with the code and with `git log`:
   - a ticked subtask whose work is not in the code;
   - an unticked subtask whose work is already done;
   - features or descriptions that the code contradicts;
   - `status` that disagrees with the subtasks (for example `review` with unticked subtasks), a `current_subtask` left behind, `depends_on` pointing at a missing spec, or a file that breaks the format.
2. Fix the specs with small Edit calls so they describe what is true now. Tick or untick subtasks to match the code, correct the text, and set `updated` to today on each spec you change. Never set `status: done`, and do not move a spec to `done` or into the archive.
3. Anything you cannot judge from the code: add an open question instead of guessing.
4. Do not change code. Finish by listing, per spec, what you corrected and why.
