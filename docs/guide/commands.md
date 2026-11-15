# Commands

## In a Claude chat

Type these in a chat open in your project folder. With the plugin, every command starts with `/specboard:`, as in `/specboard:run-spec T-001`. If you set up with the terminal `init` instead, drop the `specboard:` (`/run-spec T-001`).

| Command | What it does |
|---|---|
| `/specboard:setup [folder]` | Sets up Spec Board in a project, new or existing. It looks for existing plans, asks whether to import them or start fresh, asks if you need milestones, shows the structure as a tree and waits for your OK, then opens the board. |
| `/specboard:structure [ID or milestone]` | Prints the board as a tree: milestones, specs, subtasks. With an ID, one spec. With a milestone name, one milestone. It changes nothing. |
| `/specboard:sync-specs [ID]` | Brings the board in line with the code. It compares the specs and logs with the code and git history, shows the changes as a tree, and applies them after your OK. With an ID, only that spec. It never sets a spec to Done and never deletes files. |
| `/specboard:plan-project [notes]` | Sets up a new project or an existing codebase: reads what's there, asks a few questions, writes `config.md` with the closing steps, and suggests the first specs as drafts. It never changes your code. |
| `/specboard:create-spec <id or idea>` | Turns an idea, or a draft from the board, into a full spec with features, a "Done when" list, questions and subtasks. In a chat it may first ask you a couple of questions. It doesn't start the work. |
| `/specboard:import-specs <path>` | Turns plans from another tool (Spec Kit, OpenSpec, or your own notes) into cards. It shows you what it will make and waits for your OK. It never edits the files it reads. |
| `/specboard:reorganize [instructions]` | Tidies the board: splits big specs, merges small ones, reorders, fixes dependencies, and creates, renames or reorders milestones. Without instructions it proposes changes and waits for your OK. |
| `/specboard:run-spec <id>` | Works through a spec's subtasks, with a commit and a log for each, then checks "Done when" and moves the card to Review. It stops at a `(you)` step that has work after it. |
| `/specboard:next` | Picks the most urgent spec that isn't blocked (from the current milestone first) and runs it. |
| `/specboard:update-spec <id> <instructions>` | Changes a spec as you describe. |
| `/specboard:refresh-overview` | Rewrites `overview.md` from the current state of the specs. |
| `/specboard:refresh-logs [id]` | Brings subtask logs up to date from what was actually done, using git history. |
| `/specboard:correct-specs [id]` | Finds specs that no longer match the code and fixes them. |

Any command that would create or change several specs shows the result as a tree first and waits for your OK. In plan mode it puts the tree in the plan and writes nothing until you approve.

## In a terminal

The rows below show `specboard <command>`. With the plugin, that is the command Claude runs for you (it is on Claude's PATH, not necessarily yours); when you run `init` that way, add `--no-skills`. Without the plugin, run the same thing from a copy of the Spec Board repo as `npm run specboard -- <command>`, and open the board with `npm run board -- "<project>"`. Use real paths, without the `<` and `>`.

| Command | What it does |
|---|---|
| `specboard [path]` | Opens the board for a project (the current folder if you give no path). Options: `--port N` to choose the port, `--no-open` to skip opening the browser, `--detach` to start it in the background and return. |
| `specboard init [path]` | Sets up a project: creates `.specboard/`, copies the commands to `.claude/skills/`, and asks you to approve the actions background runs may use. Options: `--yes` (don't ask questions), `--runs yes` or `--runs no` (answer the runs question), `--no-skills` (don't copy the commands), `--force-skills` (replace copied commands with the current ones). |
| `specboard allow "<rule>" [path]` | Adds one rule to the actions background runs may use. It always asks you first. |
| `specboard tree [path]` | Prints the board as a tree. Options: `--spec ID` for one spec, `--milestone NAME` for one milestone. This is what `/specboard:structure` runs. |
| `specboard --version` | Prints the version. |

There is also `specboard hook-tokens`. The plugin runs it by itself after Claude writes a subtask log, to count tokens. You never run it yourself.

## On the board

| Action | Where |
|---|---|
| Open a file in VS Code | Click its path. Without VS Code, this copies the full path. |
| Read this documentation | The menu under the logo |
| Sync the whole board with the code | **Sync with code** in the logo menu |
| Sync one spec with the code | **Sync** in the card, beside **Run** |
| Turn token tracking on or off | **Settings** in the logo menu |
| Choose light, dark or system theme | **Theme** in the logo menu |
| See every log, with search | **Logs**, at the right end of the header |
| Turn Simple mode on or off | **Simple mode** in the header (the logo menu on a small screen) |
| Switch project | The project menu |
| Switch between board and table | The board and table icons in the filter bar |
| Add a spec | **Add new spec**, bottom right |
| Move a card | Drag it, or use its status menu |
