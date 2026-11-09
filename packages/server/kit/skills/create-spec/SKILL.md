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

1. If the input is an existing spec ID (`T-` and digits), read `.specboard/specs/<ID>-*/spec.md`. This is a draft from the board: keep its `id`, `title` and the idea it describes, and fill in the rest. Stop and say so if no such spec exists.
2. Otherwise the input is a new idea. Pick the next free ID, make a short title from the idea, and create `.specboard/specs/<ID>-<slug>/spec.md` with the Write tool.
3. Read what you need to write a good spec: `.specboard/config.md`, `.specboard/overview.md`, the reference documents listed in `config.md`, and the code the idea touches. Read the other specs so you do not duplicate them.
4. Write the spec:
   - `## Spec`: what it is and why, in plain words.
   - `## Features`: a bullet list of what the user will be able to do.
   - `## Open questions`: every decision you would otherwise have to guess, as questions with the right type, each followed by `  > answer:`. Ask rather than assume. Mark each one required or optional and add a recommendation, as the `specboard` skill describes. An empty section is fine only if nothing is unclear.
   - `## Subtasks`: small steps in the order they should be built, numbered from 1, each doable and testable on its own. All unticked.
5. Set the front matter: `status: todo`, `urgency` (low, normal, high or urgent, judged from the idea), `categories`, `depends_on` (IDs of specs that must finish first), `draft: false`, `current_subtask: null`, `created` and `updated` to today (keep `created` if it already exists).
6. Do not start the work and do not change code. Finish by telling the user the ID, how many required questions need answers on the board, how many optional ones there are, and how many subtasks there are.
