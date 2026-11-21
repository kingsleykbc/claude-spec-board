---
name: setup
description: Set up Spec Board in a project, new or existing. Finds existing plans, imports them or starts from scratch, previews the structure as a tree, then opens the board. Use when someone asks to set up spec board here, add Spec Board to a project, or track a project with Spec Board. Also use when someone asks to plan, start or build a project with Spec Board (for example 'use spec-board to plan a project that …'). Usage /specboard:setup [folder]
argument-hint: [folder]
---

Before anything else, load the `specboard` skill with the Skill tool (it may be listed as `specboard:specboard`) and follow it. It holds the file format and the rules for this command. If it cannot be loaded, say so and stop.

If the project has a `CLAUDE.md`, Read it first and follow it, except where it conflicts with these rules.

Input: $ARGUMENTS

Any input is the project folder. If the request describes the project (for example 'use spec-board to plan a project that …'), treat that as the project notes for plan-project, not as a folder. Ask one question at a time and wait for each answer.

## Steps

1. **Where.** Use the folder given, or ask which project folder to set up, suggesting the current one. If it already has `.specboard/config.md`, say so. When the person wants to turn on background runs or update their allowed commands (the board tells them to run setup again for this), run `specboard init --yes --no-skills --runs no "<folder>"` to print the lists (it changes nothing that is there), do step 7, and stop. Otherwise offer `/specboard:structure` (the board as a tree), `/specboard:import-specs <path>` or `/specboard:sync-specs` instead, and stop.
2. **Look first.** Search the folder (Glob, Grep) for existing plans: Spec Kit (`specs/*/spec.md`, `tasks.md`), OpenSpec (`openspec/`), and roadmap or plan documents (README roadmaps, `docs/plans`, `*plan*.md`, `TODO.md`). Say what you found in a few lines.
3. **Choose.** If you found plans, ask: import them, or start from scratch. If you found none, say so and go on from scratch.
4. **Preview.** Work out the specs (and milestones) without writing anything. Read `../import-specs/SKILL.md` (import) or `../plan-project/SKILL.md` (from scratch), relative to this skill's base directory. Follow `plan-project` steps 2, 3 and 5 (skip its step 1: this command creates config.md in step 5), or `import-specs` steps 1 to 3. Its questions about phases (milestones, groups of specs that ship together), tests and commits are asked there. Show the structure as a tree (see "Proposing changes" in the rules) and wait for an OK or changes.
5. **Set up.** Run `specboard init --yes --no-skills --runs no "<folder>"`. It creates `.specboard/` with `created:` in config.md and registers the project; runs are decided in step 7. Then write config.md and the specs: Follow `plan-project` steps 4 and 6 (from scratch) or `import-specs` step 4 (import), skipping what this command already asked or showed in step 4 (drafts only; each is written up later with `/specboard:create-spec <ID>`). With milestones, write `milestones:` in config.md and `milestone:` on each spec.
6. **Old plan files** (after an import only). Ask: keep both, or Spec Board only, and say with the question: "Spec Board only moves the old files into `.specboard/imported/`; deleting `.specboard` later deletes them too." Keep both changes nothing. Spec Board only moves the old files into `.specboard/imported/<source-name>/` (for example `spec-kit`, `openspec`, `plans`) and never deletes anything:
   - First Write `.specboard/imported/<source-name>/README.md` saying where the files came from and on what date (this also makes the folder).
   - Leave README.md and any file that holds more than the plan where it is, and say so.
   - For each other file or folder git tracks, run `git mv "<path>" .specboard/imported/<source-name>/`.
   - Copy files git does not track with Read and Write, and tell the person which originals they can delete. Never delete them yourself.
   - Then Edit `references:` in config.md, and any `Source:` line in the specs, to the new `.specboard/imported/<source-name>/…` paths, so nothing points at a file that moved.
7. **Background runs.** Run `specboard init --yes --no-skills --runs no "<folder>"` again, so the lists it prints include the rule for the project's `test_command` (config.md is written now). Show those allow and deny lists and ask whether the board may run Claude in the background with them. Yes: run `specboard init --yes --no-skills --runs yes "<folder>"`, which writes those rules. No: change nothing; the board shows that Claude isn't connected to it, and the person runs commands in the chat.
8. **Finish.** Summarise in the chat: files made, specs created (IDs, with milestones if any), what was moved and where, and whether background runs are on. Then run `specboard --detach "<folder>"` so the board opens in the browser, and say that it did.

If `specboard` is not found, say that the Spec Board plugin must be on (`/plugin install specboard@spec-board`) and stop.
