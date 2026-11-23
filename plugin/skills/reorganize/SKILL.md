---
name: reorganize
description: Tidy the whole board (split big specs, merge small ones, reorder, fix dependencies, re-categorise, organise milestones). Usage /reorganize [instructions]
disable-model-invocation: true
argument-hint: [instructions]
---

Before anything else, load the `specboard` skill with the Skill tool (it may be listed as `specboard:specboard`) and follow it. It holds the file format and the rules for this command. If it cannot be loaded, say so and stop.

If the project has a `CLAUDE.md`, Read it first and follow it, except where it conflicts with these rules.

Input: $ARGUMENTS

Any input is the person's instructions for what to change.

## Steps

1. Read `.specboard/config.md` and every `.specboard/specs/*/spec.md` and their logs (Glob, then Read). Leave the archive alone.
2. With instructions, plan exactly those changes. Without, look for:
   - specs to split or merge, by "Spec or subtask?" in the rules;
   - near-duplicates, which could be merged;
   - with milestones: specs with no milestone or a name not in `milestones:`;
   - missing or circular `depends_on`, or `depends_on` pointing at a spec that does not exist;
   - specs without `## Done when` or without the `closing_steps` from `.specboard/config.md`;
   - categories that do not match the rest of the board.
3. Propose the changes as a tree (see "Proposing changes" in the rules), followed by a short list of why, and wait for the person's OK. If there is nothing worth changing, say so and stop.
4. On the OK, make the changes with small Edit calls, or the Write tool for a new spec, keeping the same safety rules as `/update-spec`:
   - Subtasks that are ticked or have a log keep their numbers and titles; renumber only unticked ones. Logs stay with their spec and keep their numbers.
   - Answers already given are kept, and question numbers are never reused.
   - Never set `status: done`, and never move spec folders yourself. The only archiving is a merge's, below.
   - `## To review` items and their ticks are kept. A split moves each item to the part it checks.
   - A split keeps the original ID on the first part, with every ticked or logged subtask, and gives the next free IDs to the rest. Update `depends_on` across the board so it still points at the right part.
   - A merge keeps the card with the most finished work (the lower ID if equal). Append the other card's `## Spec`, `## Features` and `## Done when` content to the kept card, its unanswered questions with new numbers, its unticked To review items to the kept card's `## To review`, and only its unticked subtasks as new subtasks, placed before the kept card's closing steps and trailing `(you)` steps (renumber unticked subtasks as needed). Drop the other card's duplicate closing steps. Point any `depends_on` on the other card at the kept card.
   - The other card's ticked subtasks, answered questions and logs stay with it. Once its content is in the kept card, archive it with `specboard archive <ID>` (see Archiving in the rules). If that is missing or refused, tell the person to use Archive in that card's ⋯ menu.
   - Milestones: create, rename or reorder them in `milestones:` in `.specboard/config.md`, and move a spec by changing its `milestone:`. A rename changes every spec that uses the old name. Removing a milestone moves its specs to another one or to none, as agreed.
   - Set `updated` to today on every spec you change.
5. If a change would need a decision you cannot make, add an open question to that spec instead of guessing.
6. Do not change code. Finish with a short list of what changed, per spec, which cards were archived, and any the person still needs to archive on the board.
