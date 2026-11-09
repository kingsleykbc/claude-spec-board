---
name: refresh-overview
description: Rewrite .specboard/overview.md from the current state of all specs. Usage /refresh-overview
disable-model-invocation: true
---

Before anything else, load the `specboard` skill with the Skill tool (it may be listed as `specboard:specboard`) and follow it. It holds the file format and the rules for this command. If it cannot be loaded, say so and stop.

Optional hint from the user: $ARGUMENTS

## Steps

1. Read `.specboard/config.md` and every spec under `.specboard/specs/` (and note what is in `.specboard/archive/`).
2. Rewrite `.specboard/overview.md` with the Write tool. Front matter: `updated: <today>`. Body: a short progress summary in plain words:
   - what the project is, in a sentence or two;
   - where things stand: how many specs are To-do, Doing, Review and Done, and what each Doing and Review spec is about;
   - what is blocked and why (unanswered questions, unfinished dependencies);
   - what comes next.
3. Base it only on the files. Do not change any spec. Finish by saying the overview was refreshed.
