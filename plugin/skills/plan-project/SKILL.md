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

1. If there is no `.specboard/config.md`, the project is not set up: say so, suggest `/specboard:setup` (or `specboard init "<project folder>"` in a terminal), and stop. This command does not install anything.
2. Look at the folder first. If there is code, read enough of it to describe what it does today: the README, package files, the main folders and any existing docs. Describe what exists before planning changes. Read the existing specs too, so you do not suggest work that is already on the board.
3. Ask these questions in the chat, one at a time, waiting for each answer (at most 7). Show a suggested answer with each, written `(suggested: …)`. If the person says "skip", take the suggestion. Leave a question out when the input or the project already answers it, and say what you assumed instead.

   | # | Question | Suggestion | Goes to |
   |---|---|---|---|
   | 1 | What are you building? | the input (usually skipped); for existing code, what you found | the `config.md` body |
   | 2 | Stack? | the project files, else a simple default for that kind of app | `## Stack` in the `config.md` body |
   | 3 | Must-have features for the first version? | the input | the specs |
   | 4 | Any design references (links, image paths, or none)? | none | links and image or other design file paths go under `## Design` in the `config.md` body; only `.md` files inside the project go in `references` |
   | 5 | Split into phases (milestones, see the rules)? | yes when the work comes to about 6 or more specs, or falls into a first usable version plus later parts (for example the customer side first, the admin side later), or plans already in phases; else no. With yes, name each phase and what goes in it | `milestones` |
   | 6 | After each spec: run tests (which command)? Update docs? | the command you detect; "update the README" only if one exists | `closing_steps`, `test_command` |
   | 7 | Commit after each task? | yes; only asked when there is a git repo (the folder or a parent has `.git`) | `commits` |

   Size up the work from the answers so far before asking 5; the person should not have to bring up phases. Leave 5 out only when the person already said whether to use phases, or when the work is a few small specs with no later part: then say "Small project, so no phases."

   With no git repo, do not ask 7: write `commits: false` and say "No git repo found, so tasks won't be committed."
4. Write `.specboard/config.md`: `name`, `references` (existing `.md` docs inside the project worth reading, as repo-relative paths), `closing_steps` (from the answers, for example `[Write tests, Update the docs]`), `test_command` (the tests command, as a quoted string like `"npm test"`; leave it out when there are no tests), `commits` (`true` or `false`), `milestones` (large projects only, in order), and the body: the description, then `## Stack` and `## Design` (the links and design file paths, or "none"). Keep `created`. `specboard init` leaves a bare file (only `name` and empty `references`): fill that in. If it already holds more than that, show the person exactly what would change and ask first. Change it with small Edit calls and keep everything else.
5. Suggest the first specs as a tree (see "Proposing changes" in the rules), in the order they should be built, grouped by milestone when there are milestones. Size them by "Spec or subtask?" in the rules. Wait for the person's OK or changes.
6. On the OK, create each one as a draft with the Write tool, using the next free IDs: front matter with `status: todo`, `draft: true`, `depends_on` set from the order, `milestone` (when there are milestones), `urgency`, `categories`, `current_subtask: null`, `created` and `updated` to today, and only a short `## Spec` (the first sentence plus a line or two), with no subtasks or `## To review` yet. Do not write full specs in bulk: each one is written up later with `/create-spec <ID>`.
7. Do not change code. Finish by saying what is in `config.md` and listing the drafts with their IDs and dependencies, then suggest `/create-spec <ID>` for the first one.
