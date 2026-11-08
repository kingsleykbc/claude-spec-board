---
name: refresh-logs
description: Fill in missing subtask logs from git history. Usage /refresh-logs [id]
disable-model-invocation: true
argument-hint: [id]
---

Before anything else, read `.claude/skills/specboard/SKILL.md` with the Read tool and follow it. It holds the file format and the rules for this command. If that file does not exist, load the `specboard` skill instead.

Limit to this spec if an ID is given, otherwise do every spec: $ARGUMENTS

## Steps

1. For each spec, list its ticked subtasks and the files in its `logs/` folder. A ticked subtask with no log, or a log with an empty `commit` or `files`, needs work.
2. Find the commit for each. Runs commit with the message `<ID> · <n>. <title>`, so search with `git log --grep="<ID> · <n>\." --format="%h %cd" --date=format:"%Y-%m-%d %H:%M"`, then get the files with `git diff --name-only <hash>~1 <hash>`.
3. If there is no such commit, look through `git log --stat` for commits that plainly match the subtask. Use a match only if you are sure; otherwise leave `commit` empty and write in the entry that the commit was not found.
4. Write or complete `logs/<n>-<slug>.md` in the log format with the real hash, the files, and a dated entry (use the commit's date) saying what the commit did, based on its diff. Never invent details. Keep existing entries and add to them.
5. Do not change code, ticks or statuses. Finish by listing the logs you created or completed.
