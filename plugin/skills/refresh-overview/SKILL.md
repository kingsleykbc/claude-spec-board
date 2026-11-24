---
name: refresh-overview
description: Rewrite .specboard/overview.md from the current state of all specs, and say when the board and the code look out of sync. Usage /refresh-overview
disable-model-invocation: true
---

Before anything else, load the `specboard` skill with the Skill tool (it may be listed as `specboard:specboard`) and follow it. It holds the file format and the rules for this command. If it cannot be loaded, say so and stop.

If the project has a `CLAUDE.md`, Read it first and follow it, except where it conflicts with these rules.

Optional hint from the user: $ARGUMENTS

## Steps

1. Read `.specboard/config.md` and every spec under `.specboard/specs/` (and note what is in `.specboard/archive/`).
2. Write the summary. It is a quick status report for a person getting a sense of where the project stands, not a list of cards:
   - 1 to 3 short paragraphs in plain words: what the project is, what has been done, what's in progress, what's left or next, and anything waiting on the person (questions to answer, work to review, checks that failed).
   - No ticket IDs, file names, or technical detail: no front-matter terms (status, subtask numbers), commands or paths. Name the work by what it does, for example "the meal planner", not its ID or folder.
   - Lists or bullets only when they really help, for example when four or more things need the person.
   - Use everyday terms and units, the way a person would say them: money as "£10.00", not "1000 cents"; never a value as the code stores it.
3. Check, read-only, whether the board and the code are out of sync. For each active spec, compare its unticked subtasks and its column with the code and `git log` (without git, the code only): is there work in the code that no subtask has ticked; is a card further along than its work, for example in Review or Done with no code for it; is there clear finished work in the code with no card; or does a spec describe something that no longer exists? Do not read other skill files for this: background runs can't read them. Only look: write nothing except `.specboard/overview.md`. Change no spec, log or proposal, and make no commit for this check.
   - If anything would change, end the overview with a section `## Out of sync` holding 1 or 2 plain sentences on what's off, with no IDs. For example: "Two cards look further along in the code than on the board."
   - If nothing would change, there is no `## Out of sync` section.
   - Without a git repo, or when the check can't run (a refused command, code you can't read), leave the section out too.
4. Rewrite `.specboard/overview.md` with the Write tool. Front matter: `updated: <today>`. Body: the summary, then the `## Out of sync` section when step 3 found something.
5. Base the summary only on the specs and their logs. Do not change any spec. Finish by saying the overview was refreshed, and whether the board and the code look out of sync.
