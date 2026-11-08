---
name: next
description: Pick the most urgent unblocked To-do spec and run it. Usage /next
disable-model-invocation: true
---

Before anything else, read `.claude/skills/specboard/SKILL.md` with the Read tool and follow it. It holds the file format and the rules for this command. If that file does not exist, load the `specboard` skill instead.

Optional hint from the user: $ARGUMENTS

## Steps

1. Read every `.specboard/specs/*/spec.md` (Glob, then Read). Ignore the archive.
2. Candidates are specs with `status: todo` and `draft: false` that are not blocked: every question answered, and every `depends_on` spec finished (status `done` or in the archive).
3. Choose by urgency (`urgent`, then `high`, `normal`, `low`). Break ties by the lowest ID.
4. If there is no candidate, say why (for example: "T-004 waits on question Q2, T-005 waits on T-004") and stop.
5. Otherwise say which spec you chose and why, then do exactly what `/run-spec <ID>` does: read `.claude/skills/run-spec/SKILL.md` and follow its steps for that ID.
