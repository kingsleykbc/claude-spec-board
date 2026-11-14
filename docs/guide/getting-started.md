# Getting started

## What you need

- Node.js 22
- git
- [Claude Code](https://code.claude.com/docs), logged in
- VS Code is optional. With its `code` command on your PATH, clicking a file path on the board opens the file there. Otherwise the click copies the full path.

## Set up a project

Spec Board isn't published yet, so run its commands from a copy of this repo:

```
npm install
npm run specboard -- init "<your project folder>"
```

Use a real path in place of `<your project folder>`, without the `<` and `>`. The project should be a git repo, because a run makes one commit per subtask.

`init` does four things:

1. Creates `.specboard/` in your project, which holds your specs.
2. Copies Spec Board's commands to `.claude/skills/`, so `/run-spec` and the others work in a Claude chat there.
3. Shows the actions a background run may use, and asks you to approve them.
4. Adds the board's list of projects and your approvals to `~/.specboard/`, outside the repo.

## Plan the project

Open a Claude chat in your project folder and run:

```
/plan-project
```

It works for a new project and for an existing codebase. For existing code, Claude reads it first so it can describe what the project does today. Then it asks a few questions, one at a time: what the project is for, whether you want tests (and the command to run them), and which docs it should keep up to date. It writes `.specboard/config.md`, including the closing steps every spec will end with, and suggests your first specs. When you say OK it adds them as drafts, which you write up one at a time with `/create-spec`. It never changes your code.

If you already have plans from another tool, `/import-specs <path>` turns them into cards instead.

## Open the board

```
npm run board -- "<your project folder>"
```

The board opens in your browser and stays live until you stop the command. It remembers each project, so you can switch between them from the project menu.

### Simple mode

Turn on **Simple mode** in the bar above the board for a quieter view. Each card shows only its ID, title, the start of its description, subtask progress and what Claude is doing right now. Everything else is one click away:

- **On a card:** press **⋯** to see whether it's blocked or has a file problem, whether it's waiting on your review, and its urgency, categories and dependencies. A red dot on **⋯** means the card is blocked or its file has a problem.
- **Above the board:** the "to review", "questions for you" and "blocked" counts move behind **⋯** on the right. A dot on it means something is waiting on you.
- **In a card's detail:** urgency, categories and dependencies move behind **⋯** next to the status. You can still change them there.

The board remembers your choice in this browser, for every project.

## Use it from Claude

Open a Claude chat in your project folder, in the terminal or the desktop app, and use the commands directly:

```
/plan-project
/create-spec A page where customers can book a time slot
/run-spec T-001
```

[Running a spec](running-specs.md) explains what happens next, and [Commands](commands.md) lists the rest.

### As a plugin

The commands are also packaged as a Claude Code plugin in `plugin`. In the terminal version of Claude Code you can load it for one session, without running `init`'s copy step in that project:

```
claude --plugin-dir "<this repo>/plugin"
```

Plugin commands carry the plugin's name, for example `/specboard:run-spec T-001`. The project still needs a `.specboard/` folder.

### Not available yet

These are planned for when Spec Board is published. Neither works today, and the final package name isn't chosen:

- **`npx`:** running `init` and the board from any folder, with no copy of this repo.
- **Plugin install:** installing the plugin from a marketplace, so that "use spec-board to create a spec" works in any Claude chat, and Claude can set up a project and open the board for you.

## Where your files live

| Location | What's there | Commit it? |
|---|---|---|
| `.specboard/` in your project | Specs, subtask logs, overview, config | Yes |
| `.claude/skills/` in your project | Copies of Spec Board's commands | Your choice |
| `.claude/settings.json` in your project | Actions allowed in a chat | Your choice |
| `~/.specboard/` in your home folder | The list of projects and the actions approved for background runs | No, it's outside the repo |

To get newer commands into a project after updating Spec Board, run `init` on it again with `--force-skills`. Without that flag, `init` keeps any copy that differs from the current one, because you may have edited it.
