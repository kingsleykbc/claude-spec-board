---
name: structure
description: Show the board as a tree (milestones, specs, subtasks), or one spec or milestone. Read-only. Usage /structure [ID | milestone]
disable-model-invocation: true
argument-hint: [ID | milestone]
---

Before anything else, load the `specboard` skill with the Skill tool (it may be listed as `specboard:specboard`) and follow it. It holds the file format and the rules for this command. If it cannot be loaded, say so and stop.

If the project has a `CLAUDE.md`, Read it first and follow it, except where it conflicts with these rules.

Input: $ARGUMENTS

This command is read-only: change no file.

## Steps

1. Pick the command from the input:
   - nothing: `specboard tree`
   - a spec ID (`T-` and digits): `specboard tree --spec <ID>`
   - anything else is a milestone name: `specboard tree --milestone "<name>"`
2. Run it with the Bash tool from the project folder and print its output unchanged in a code block.
3. If it ends with an error ("Unknown spec", "Unknown milestone", "No .specboard folder"), say so in plain words and stop. For an unknown milestone, list the names in `milestones:` in `.specboard/config.md`.
4. If the `specboard` command is not found or is refused, read the files and build the same tree by the rules in "Proposing changes", without any `+`, `~` or `→` marks.
