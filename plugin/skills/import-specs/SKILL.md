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
   - Ask only what the plans do not answer, one at a time, each with `(suggested: …)` ("skip" takes the suggestion), and state what you assumed for the rest: phases (whether the project needs milestones, only when the plans do not show them and the project does not already list `milestones:`), after each spec: run tests (which command)? update docs? (suggested: the command you detect, and "update the README" only if one exists; the answers go to `closing_steps` and `test_command` in `.specboard/config.md`), and commits (`commits` in `.specboard/config.md`, suggested yes; only asked when there is a git repo, otherwise write `commits: false` and say "No git repo found, so tasks won't be committed.").
   - Also ask `Keep the specs in git?`, only when there is a git repo and `.specboard/config.md` has no `specs_in_git` yet. Suggest yes, and say briefly what each answer means. Yes: Claude commits `.specboard/` in its own commit, so the specs are pushed with your code and shared. No: they stay on this machine, and `.specboard/` is hidden from git. The answer goes to `specs_in_git`.
   - Docs that describe the product or its design (the README, architecture and design docs) go in `references:` in `.specboard/config.md`. Only `.md` files inside the project folder can be linked. Plan docs outside the project are linked through their copy in `.specboard/imported/<source>/`, when the person chose to have setup copy them there; otherwise list them in the preview as not linkable. For a folder of design files, link the Markdown files inside it. Never link a file that does not exist.
3. Show the person the result first as a tree (see "Proposing changes" in the rules), with each new card marked `+` and the source files it comes from under it, then the docs you would add to `references:`, and the `closing_steps`, `test_command`, `commits` and `specs_in_git` you would write, then anything you cannot place, and any tasks that clearly belong to another repo (those are listed, not imported, unless the person says otherwise). Wait for an OK.
4. On the OK, first write `.specboard/config.md` with small Edit calls, keeping everything else: `closing_steps`, `test_command`, `commits`, `specs_in_git` (`true` or `false`, when you asked), `milestones` (as the answers and phases say) and `references` (the docs above). When you asked about git, run `specboard init --specs-in-git yes "<project folder>"` (or `no`) on its own with the Bash tool: it only updates git's local exclude file. Skip this when setup already ran init with `--specs-in-git`. Then write one spec per card with the Write tool, using the next free IDs, following "Writing a good spec" in the rules:
   - description → `## Spec`, with a first sentence that explains the whole card. End the section with a line naming the source file, for example `Source: specs/003-checkout/spec.md`, so nothing is lost.
   - acceptance criteria or scenarios → `## Done when`, shortened to 2 to 5 plain checks.
   - task lists → `## Subtasks`: done items stay ticked, items the person must do before or during the work become `(you)` subtasks. Add the `closing_steps` from `.specboard/config.md` only to cards that are not already finished, after Claude's work (the order in the rules).
   - manual test steps, and checks only the person can do once the work is done (including such acceptance criteria) → `## To review`, unticked: plain items for a small card, `###` groups of steps with `  > expected:` lines for a larger one. Every item gets `  > step:` lines before its `  > expected:` line, as "Writing a good spec" in the rules says: setup first with the project's real commands, then the real URL and port from the code, then where to click. Never as `(you)` subtasks at the end.
   - open points → `## Open questions`, each with an empty `  > answer:` line.
   - order and "depends on" notes → `depends_on`.
   - status → `status`: not started is `todo`, in progress is `doing`, finished is `review` at most. Never set `status: done`; only a person does.
   - phase or milestone → `milestone`, and use the names written to `milestones:` in `.specboard/config.md`.
   - set `draft: false`, `current_subtask: null`, `urgency`, `categories`, and `created` and `updated` to today.
5. Do not change code. Finish by listing the cards made with their IDs and sources, the cards the person can move to Done because their work was already finished, and anything you left out and why.
