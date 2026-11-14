---
name: plan-project
description: Set up Spec Board for a new project or an existing codebase, then suggest the first specs as drafts. Usage /plan-project [notes]
disable-model-invocation: true
argument-hint: [notes]
---

Before anything else, load the `specboard` skill with the Skill tool (it may be listed as `specboard:specboard`) and follow it. It holds the file format and the rules for this command. If it cannot be loaded, say so and stop.

If the project has a `CLAUDE.md`, Read it first and follow it, except where it conflicts with these rules.

Input: $ARGUMENTS

Any input is the person's notes about the project. Use them, and do not ask what they already answer.

## Steps

1. If there is no `.specboard/config.md`, the project is not set up: say so, tell the person to run `npm run specboard -- init "<project folder>"` from the Spec Board folder (the `specboard init` command), and stop. This command does not install anything.
2. Look at the folder first. If there is code, read enough of it to describe what it does today: the README, package files, the main folders and any existing docs. Describe what exists before planning changes. Read the existing specs too, so you do not suggest work that is already on the board.
3. Ask the person a few questions in the chat, one at a time, waiting for each answer:
   - what the project is for (if the code already shows it, say what you found and ask them to confirm);
   - whether each spec should end with tests, and if so with what command;
   - which docs should be kept up to date as work finishes.
4. Write `.specboard/config.md`: `name`, `references` (existing docs worth reading, as repo-relative paths), `closing_steps` (from the answers, for example `[Write tests, Update the docs]`), and the description as the body. `specboard init` leaves a bare file (only `name` and empty `references`): fill that in. If it already holds more than that, show the person exactly what would change and ask first. Change it with small Edit calls and keep everything else.
5. Suggest the first specs as a short list: title, the first sentence of its `## Spec`, and the order they should be built in. Wait for the person's OK or changes.
6. On the OK, create each one as a draft with the Write tool, using the next free IDs: front matter with `status: todo`, `draft: true`, `depends_on` set from the order, `urgency`, `categories`, `current_subtask: null`, `created` and `updated` to today, and only a short `## Spec` (the first sentence plus a line or two). Do not write full specs in bulk: each one is written up later with `/create-spec <ID>`.
7. Do not change code. Finish by saying what is in `config.md` and listing the drafts with their IDs and dependencies, then suggest `/create-spec <ID>` for the first one.
