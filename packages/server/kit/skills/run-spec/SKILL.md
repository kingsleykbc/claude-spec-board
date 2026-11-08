---
name: run-spec
description: Work through one spec's subtasks in order, committing and logging each one, then move the card to Review. Usage /run-spec <id>
disable-model-invocation: true
argument-hint: <id>
---

Before anything else, read `.claude/skills/specboard/SKILL.md` with the Read tool and follow it. It holds the file format and the rules for this command. If that file does not exist, load the `specboard` skill instead.

Run the spec whose ID is: $ARGUMENTS

## Steps

1. Find `.specboard/specs/<ID>-*/spec.md` (Glob) and read it, then read its existing logs. Say so and stop if there is no such spec, or if `draft: true` (it needs `/create-spec` first), or if `status` is already `review` or `done` and every subtask is ticked.
2. **Refuse to start** (change nothing, say why, stop) when:
   - any question under `## Open questions` is unanswered. List them with their numbers; or
   - a spec in `depends_on` is not finished, or does not exist. Name it.

   Otherwise read the saved answers and use them as decisions.
3. Edit the front matter: `status: doing`, and `updated` to today.
4. For each unticked subtask, in order:
   1. Set `current_subtask: <n>`.
   2. Do the work the subtask describes, using the Spec and Features sections and the answers.
   3. Run the project's tests with its test command (from its `package.json`, README or config), as a single command on its own. If the subtask needs checking and the tests do not cover it, add a test to the project and run that; do not run ad-hoc scripts. If they fail, fix the cause. If you cannot, treat it as step 5 and do not commit failing work.
   4. Commit only this subtask's code with the Bash tool: `git add <the files you changed>`, then `git commit -m "<ID> · <n>. <subtask title>"`. Do not add `.specboard/` files to the commit.
   5. Get the short hash with `git log -1 --format=%h` and the changed files with `git diff --name-only HEAD~1 HEAD`.
   6. Write `.specboard/specs/<ID>-<slug>/logs/<n>-<slug>.md` in the log format: `subtask`, `commit`, `files`, and a dated entry (`### YYYY-MM-DD HH:mm`) of what you did.
   7. Tick the subtask (`- [x]`) and set `updated`.
5. When you reach a decision you cannot make from the spec and its answers (or a needed action is refused, or tests cannot be fixed): add an open question (`- [ ] Q<k> (<type>): <text>` then `  > answer:`), set `current_subtask: null`, leave the status as `doing`, say what you need, and **stop**. Do not guess and do not carry on to the next subtask.
6. When every subtask is ticked: set `current_subtask: null`, `status: review` and `updated` to today. Never set `status: done`.
7. Finish with a short summary: subtasks completed, commits made, anything the reviewer should look at.
