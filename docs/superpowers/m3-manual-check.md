# M3 manual check

Date: 2026-11-09. Branch `m3-claude`. Claude Code 2.1.302, the user's default model (`claude-opus-5-5`), a real login, the board's default `claude` launch (no test wrapper).

**Setup.** A temp copy of `examples/recipe-box` with its own `git init` (neutral local `user.name`/`user.email`) and six small specs added for the check (T-201 to T-204, T-206, T-207). `SPECBOARD_HOME` pointed at a temp folder, then `specboard init --yes`, then the board on port 4993, with `CLAUDE*` and `ANTHROPIC*` variables removed so it behaved like a plain terminal. Checked in the Claude desktop built-in browser at 1280x900. Each page's toasts and the subtask rows' highlight were recorded with a MutationObserver. Clicks that started and stopped runs were sometimes sent through the page's own buttons.

| # | Item | Result | Note |
|---|------|--------|------|
| 1 | Run a small spec: live lines, subtask ticks flash, card moves to Review, toast | PASS | T-201: lines appeared as they happened ("Read", "Editing", "Running git commit"). Toasts: "Claude started", "T-201 · Subtask done" twice, "T-201 moved to Review". Two commits, `status: review`. The flash was recorded on the T-202 run (rows 1 and 2 turned `--accent-soft` at the moments they ticked). |
| 2 | Stop mid-run: process tree gone, panel shows Stopped, Run again continues | PASS | T-202: during the run, the server's children were `claude.exe` and `conhost.exe`; after Stop, the server had no children and neither PID was alive. Exactly one toast, "Stopped Claude on T-202". The panel read "Stopped by you". The stop landed after commit 1 and before its tick. Run again recognised the commit, wrote its log without redoing the work (no second commit for subtask 1), and finished in Review. That recovery rests on the model's judgement, and was seen once. |
| 3 | Answer a question Claude asked, then Run again: it picks the answer up | PASS | T-203: ended "Claude needs your answer" with a new `Q1 (text)`, card in Doing. I typed "French" and saved it on the board. Run again wrote `Bonjour` and went to Review. |
| 4 | A denied command shows the rule; `specboard allow` plus Run again gets past it | PASS, one step adapted | T-204: panel "Claude needs permission", with `specboard allow "Bash(npm config:*)"` and Copy rule. No question was left behind. A rerun without the rule was refused the same way (by accident: my first attempt to add the rule failed, which made a useful control). The real CLI refused without a terminal ("needs a terminal and your answer"), as designed, so I called the same `allowCommand` from a script, answering yes. The rerun then wrote `registry.txt` and went to Review. The real terminal prompt itself was not used here. |
| 5 | Reload mid-run: lines recover. A second tab shows the run and can't start another | PASS | During T-201, a second tab on T-202 showed "Claude is working" and its Run button was disabled, titled "Claude is already working on T-201". Reloading that tab onto T-201 showed all the earlier lines and kept following the run. |
| 6 | "Have Claude write this up", "Ask Claude to fix", Overview Refresh | PASS | Write-up on T-107: features, four questions and subtasks written, `draft: false`, toast "Claude wrote up T-107". Fix on T-206 (`urgency: hgih`): became `high`, the problem banner went, toast "T-206 is fixed". Refresh: `overview.md` rewritten, toast "Overview updated". None of them committed anything or set a status of Done. |
| 7 | Logged-out state, with a stubbed status | PASS | A second board with a status stub, on port 4994. The user was not logged out. Pressing Run gave the toast "Claude Code isn't logged in / Run `claude` in a terminal and log in", and no run started. The API returned 503. Also on port 4995, stubbed as not installed: the button reads "Copy command", with "Claude Code not found". |
| 8 | Edit a spec during a run: no silent overwrite | PASS | T-207: I typed a marker in the Spec editor, started the run, and saved after Claude had changed the file. The save was accepted, not refused, because a section save replaces only its section and the board had the latest version. Afterwards the file held both the marker and everything Claude did (three ticks, `status: review`, three commits), and the run saw no error. Nothing was lost. The conflict dialog itself did not appear in this sequence (it is covered by item 5 of `m2-manual-check.md` and by tests). |

## `git status` after the runs

Each run leaves its code committed and its bookkeeping uncommitted (ruling R8). After the runs above:

```
 M .claude/settings.json                       (from specboard allow)
 M .specboard/overview.md                      (from Refresh)
 M .specboard/specs/T-201-small-notes/spec.md  (and the same for each other spec that ran)
?? .specboard/specs/T-201-small-notes/logs/    (and the same for each spec that made commits)
```

The person commits these when they are happy with them. `documentation.md` section 9 says so.

## Observations (not failures)

- Claude added a `Co-Authored-By` line to its commits, as a second `-m`. The subject keeps the agreed `T-201 · 1. ...` format. It comes from Claude Code, not from the kit.
- After Refresh, the Overview said "Last updated 4h ago" at 04:16. `updated` is a date with no time, so it counts from the start of the day. See `m3-followups.md`.
- While a run is being prepared (the status check takes a few seconds), `GET /api/projects/:pid/run` still returns the previous run. The page was not visibly affected. See `m3-followups.md`.

**Afterwards.** All the boards were stopped and their listening ports checked closed. `examples/recipe-box` was not touched, as all of this ran on the temp copy. The real `~/.specboard` still has its timestamp from 2026-11-08.
