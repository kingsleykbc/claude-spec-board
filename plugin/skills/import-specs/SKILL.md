---
name: import-specs
description: Turn plans written for other tools (Spec Kit, OpenSpec or free-form plans) into Spec Board cards. Usage /import-specs <path>
disable-model-invocation: true
argument-hint: <path>
---

Before anything else, load the `specboard` skill with the Skill tool (it may be listed as `specboard:specboard`) and follow it. It holds the file format and the rules for this command. If it cannot be loaded, say so and stop.

If the project has a `CLAUDE.md`, Read it first and follow it, except where it conflicts with these rules.

Input: $ARGUMENTS

The input is the folder or file to import from. Never edit, move or delete the source files: only read them.

## Steps

1. Stop and say so if no path was given or it does not exist. Read the source and work out its shape:
   - Spec Kit: `specs/<n>-<name>/` with `spec.md`, `plan.md` and `tasks.md`. One card per folder.
   - OpenSpec: `openspec/changes/<name>/` with `proposal.md` and `tasks.md`. One card per change. Read `openspec/specs/` as background only; it makes no cards.
   - Free-form plans: a roadmap or README plus task files. One card per feature, sized by "Spec or subtask?" in the rules: small tasks become subtasks of a card.
2. Read the existing specs too, so you do not import something that is already on the board.
   - Phases of a whole plan (a roadmap split into Phase 1, Phase 2, ...) become milestones, in order.
   - Phases inside one Spec Kit or OpenSpec spec are task groups: their tasks become that card's subtasks in the same order, without the group headings.
   - Ask only what the plans do not answer, one at a time, each with `(suggested: …)` ("skip" takes the suggestion), and state what you assumed for the rest: phases (whether the project needs milestones, only when the plans do not show them and the project does not already list `milestones:`), tests (which command: it goes to `test_command` in `.specboard/config.md`, with a closing step), and commits (`commits` in `.specboard/config.md`, suggested yes; only asked when there is a git repo, otherwise write `commits: false` and say "No git repo found, so tasks won't be committed.").
   - Docs that describe the product or its design (the README, architecture and design docs, plan docs kept at their path, plan docs moved to `.specboard/imported/<source>/` at that path) go in `references:` in `.specboard/config.md`. For a folder of design files, link the Markdown files inside it. Never link a file that does not exist.
3. Show the person the result first as a tree (see "Proposing changes" in the rules), with each new card marked `+` and the source files it comes from under it, then the docs you would add to `references:`, and the `test_command` and `commits` you would write, then anything you cannot place, and any tasks that clearly belong to another repo (those are listed, not imported, unless the person says otherwise). Wait for an OK.
4. On the OK, write one spec per card with the Write tool, using the next free IDs, following "Writing a good spec" in the rules:
   - description → `## Spec`, with a first sentence that explains the whole card. End the section with a line naming the source file, for example `Source: specs/003-checkout/spec.md`, so nothing is lost.
   - acceptance criteria or scenarios → `## Done when`, shortened to 2 to 5 plain checks.
   - task lists → `## Subtasks`: done items stay ticked, items only the person can do become `(you)` subtasks. Add the `closing_steps` from `.specboard/config.md` only to cards that are not already finished, after Claude's work and before any `(you)` checks (the order in the rules).
   - open points → `## Open questions`, each with an empty `  > answer:` line.
   - order and "depends on" notes → `depends_on`.
   - status → `status`: not started is `todo`, in progress is `doing`, finished is `review` at most. Never set `status: done`; only a person does.
   - phase or milestone → `milestone`, and add new milestone names to `milestones:` in `.specboard/config.md` in order.
   - set `draft: false`, `current_subtask: null`, `urgency`, `categories`, and `created` and `updated` to today.
   - Also write `.specboard/config.md` with small Edit calls, keeping everything else: `references` (the docs above), `test_command`, `commits` and `milestones` (as the answers and phases say).
5. Do not change code. Finish by listing the cards made with their IDs and sources, the cards the person can move to Done because their work was already finished, and anything you left out and why.
