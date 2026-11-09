---
name: run-spec
description: Work through one spec's subtasks in order, committing and logging each one, then move the card to Review. Usage /run-spec <id>
disable-model-invocation: true
argument-hint: <id>
---

Before anything else, load the `specboard` skill with the Skill tool (it may be listed as `specboard:specboard`) and follow it. It holds the file format and the rules for this command. If it cannot be loaded, say so and stop.

If the project has a `CLAUDE.md`, Read it first and follow it, except where it conflicts with these rules.

Run the spec whose ID is: $ARGUMENTS

Follow the steps under "Running a spec" in the rules for this ID.
