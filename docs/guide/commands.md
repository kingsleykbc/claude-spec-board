# Commands

## In a Claude chat

Type these in a chat open in your project folder. If you loaded the plugin with `--plugin-dir`, start each with `/specboard:` instead of `/`, as in `/specboard:run-spec T-001`.

| Command | What it does |
|---|---|
| `/plan-project [notes]` | Sets up a new project or an existing codebase: reads what's there, asks a few questions, writes `config.md` with the closing steps, and suggests the first specs as drafts. It never changes your code. |
| `/create-spec <id or idea>` | Turns an idea, or a draft from the board, into a full spec with features, a "Done when" list, questions and subtasks. In a chat it may first ask you a couple of questions. It doesn't start the work. |
| `/import-specs <path>` | Turns plans from another tool (Spec Kit, OpenSpec, or your own notes) into cards. It shows you what it will make and waits for your OK. It never edits the files it reads. |
| `/reorganize [instructions]` | Tidies the board: splits big specs, merges small ones, reorders and fixes dependencies. Without instructions it proposes changes and waits for your OK. |
| `/run-spec <id>` | Works through a spec's subtasks, with a commit and a log for each, then checks "Done when" and moves the card to Review. It stops at a `(you)` step that has work after it. |
| `/next` | Picks the most urgent spec that isn't blocked and runs it. |
| `/update-spec <id> <instructions>` | Changes a spec as you describe. |
| `/refresh-overview` | Rewrites `overview.md` from the current state of the specs. |
| `/refresh-logs [id]` | Brings subtask logs up to date from what was actually done, using git history. |
| `/correct-specs [id]` | Finds specs that no longer match the code and fixes them. |

## In a terminal

Run these from a copy of the Spec Board repo. Use real paths, without the `<` and `>`.

| Command | What it does |
|---|---|
| `npm run specboard -- init "<project>"` | Sets up a project. Add `--force-skills` to replace its copies of the commands with the current ones. |
| `npm run board -- "<project>"` | Opens the board. |
| `npm run specboard -- allow "<rule>" "<project>"` | Adds one rule to the actions background runs may use. It always asks you first. |

## On the board

| Action | Where |
|---|---|
| Open a file in VS Code | Click its path. Without VS Code, this copies the full path. |
| Read this documentation | The menu under the logo |
| Switch project | The project menu |
| Add a spec | **Add new spec**, bottom right |
| Move a card | Drag it, or use its status menu |
