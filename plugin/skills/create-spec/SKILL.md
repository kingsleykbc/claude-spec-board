---
name: create-spec
description: Turn an idea, or a draft spec from the board, into a full spec with features, open questions and subtasks. Usage /create-spec <id|idea>
disable-model-invocation: true
argument-hint: <id|idea>
---

Before anything else, load the `specboard` skill with the Skill tool (it may be listed as `specboard:specboard`) and follow it. It holds the file format and the rules for this command. If it cannot be loaded, say so and stop.

If the project has a `CLAUDE.md`, Read it first and follow it, except where it conflicts with these rules.

Input: $ARGUMENTS

## Steps

0. If the input ends with `--board`, remove that word and skip this step: the board started you, no one is in the chat, so put every question on the board as an open question. Otherwise, before writing, ask in the chat the 2 or 3 questions whose answers would change the spec most. Send them in one message and wait for the reply. Everything else still goes on the board as open questions. If the idea is already clear, say so and go on.
1. If the input is an existing spec ID (`T-` and digits), read `.specboard/specs/<ID>-*/spec.md`. This is a draft from the board: keep its `id`, `title`, the idea it describes and any `## To review` items it has, and fill in the rest. Read its images too: the linked ones and the attachments (see Layout in the rules). Stop and say so if no such spec exists.
2. Otherwise the input is a new idea. Pick the next free ID, make a short title from the idea, and create `.specboard/specs/<ID>-<slug>/spec.md` with the Write tool. If the idea is too big for one spec ("Spec or subtask?" in the rules), propose the specs as a tree ("Proposing changes") and wait for an OK before writing any; write each one by these steps.
3. Read what you need to write a good spec: `.specboard/config.md`, `.specboard/overview.md`, the reference documents listed in `config.md`, and the code the idea touches. Read the other specs so you do not duplicate them.
4. Write the spec, following "Writing a good spec" in the rules:
   - `## Spec`: what it is and why, in plain words. The first sentence explains the whole spec.
   - `## Features`: a bullet list of what the user will be able to do.
   - `## Done when`: 2 to 5 observable checks.
   - Pictures: put the spec's images in its `images/` subfolder and link them relatively, e.g. `![Login screen](images/login.png)`.
   - `## Open questions`: every decision you would otherwise have to guess, as questions with the right type, each followed by `  > answer:`. Ask rather than assume. Mark each one required or optional and add a recommendation. Use the answers from the chat instead of asking them again. An empty section is fine only if nothing is unclear.
   - `## Subtasks`: small steps in the order they should be built, numbered from 1, each doable and testable on its own. Order: `(you)` steps needed before the work, Claude's work, then the `closing_steps` from `.specboard/config.md`, as the rules describe. No `(you)` checks at the end. All unticked.
   - `## To review`: the checks the person does once the work is done, including every Done-when line only a person can check. A small spec has 1 to 3 plain items; a larger one has `###` groups of steps, each with an `  > expected:` line. All unticked.
5. Set the front matter: `status: todo`, `milestone` (when the project has milestones: the current milestone unless the person said otherwise; keep an existing one), `urgency` (low, normal, high or urgent, judged from the idea), `categories`, `depends_on` (IDs of specs that must finish first), `draft: false`, `current_subtask: null`, `created` and `updated` to today (keep `created` if it already exists).
6. Do not start the work and do not change code. Finish by telling the user the ID, how many required questions need answers on the board, how many optional ones there are, how many subtasks there are, how many of those are `(you)` steps, and how many To review items there are.
