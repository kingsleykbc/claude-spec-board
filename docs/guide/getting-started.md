# Getting started

## What you need

- git
- [Claude Code](https://code.claude.com/docs), logged in
- Node.js 22 or later (the plugin runs its board and token counter with it). The plugin brings its own ready-built copy of the board, so you don't need to build anything.
- VS Code is optional. With its `code` command on your PATH, clicking a file path on the board opens the file there. Otherwise the click copies the full path.

## Install the plugin

In a Claude Code chat:

```
/plugin marketplace add kingsleykbc/claude-spec-board
/plugin install specboard@spec-board
```

The plugin is named `specboard`, so its commands start with `/specboard:`, as in `/specboard:run-spec T-001`. The code is at https://github.com/kingsleykbc/claude-spec-board.

## Set up a project

Open a Claude chat in your project folder, a new project or an existing codebase, and run:

```
/specboard:setup
```

You can also just say "set up spec board here". Claude goes through these steps, one question at a time:

1. **Where.** Which folder. If it already has a `.specboard/` folder, it tells you and offers `/specboard:structure`, an import or a sync instead.
2. **Look first.** It searches the folder for plans you already have: Spec Kit, OpenSpec, or roadmap and plan documents.
3. **Import or start fresh.** If it found plans it asks which. If not, it starts from scratch.
4. **Small or large.** Whether the project needs [milestones](writing-specs.md#milestones).
5. **Preview.** It shows the specs it would make as a tree, and waits for your OK or changes. Nothing is written before that.
6. **Set up.** It creates `.specboard/` and writes the specs as drafts.
7. **Old plan files.** After an import it asks whether to keep them or move them to `.specboard/imported/`. It never deletes them.
8. **Background runs.** It shows the actions a background run may use, and asks whether to turn runs on. If you say no, the board works in [manual mode](running-specs.md#manual-mode).
9. **Finish.** It summarises what it did and opens the board in your browser.

If Claude is in plan mode, it puts the tree in the plan and writes nothing until you approve it.

To see the structure again later, run `/specboard:structure`. To write up a draft, run `/specboard:create-spec <ID>`.

## Open the board

Setup opens it for you. To open it again, ask Claude to "open the board" in your project folder. Claude runs `specboard` for you, a command that is on its PATH while the plugin is on. The board opens in your browser and remembers each project, so you can switch between them from the project menu.

### Board and table

The **Board | Table** switch in the filter bar shows the same specs two ways. The board has four columns. The table has one row per spec, with its status, progress and tokens, and each row opens to show its subtasks. Filters apply to both. For a project with milestones, the board has a milestone menu that starts on the current milestone; the table shows every milestone in its own section.

### Simple mode

Turn on **Simple mode** in the bar above the board for a quieter view. Each card shows only its ID, title, the start of its description, subtask progress and what Claude is doing right now. Everything else is one click away:

- **On a card:** press **⋯** to see whether it's blocked or has a file problem, whether it's waiting on your review, and its urgency, categories and dependencies. A red dot on **⋯** means the card is blocked or its file has a problem.
- **Above the board:** the "to review", "questions for you" and "blocked" counts move behind **⋯** on the right. A dot on it means something is waiting on you.
- **In a card's detail:** urgency, categories and dependencies move behind **⋯** next to the status. You can still change them there.
- **In the header:** References, Overview and Logs move into the logo menu.

The board remembers your choice in this browser, for every project.

### The header and the logo menu

- A small dot next to the project name shows the connection: green is connected, amber is reconnecting, red is disconnected. In the project list, a green dot means that project's folder can be reached and grey means it can't.
- **Overview** shows a summary, the counts, the total tokens used and a table of every spec. **Logs** shows every subtask log in the project, newest first, with a search box. **References** lists the documents the project points Claude at.
- The menu under the logo holds **Documentation**, **Take the tour**, **Sync with code** (and **Sync proposal waiting** when one is waiting) and **Settings**. In Simple mode, and on small screens, it also holds References, Overview and Logs, and on small screens the **Manual** notice. The **Dark mode** switch is last.
- On a small screen the board scrolls sideways one column at a time, the card detail fills the screen, and the header's extra buttons join the logo menu.

## Use it from Claude

Open a Claude chat in your project folder, in the terminal or the desktop app, and use the commands directly:

```
/specboard:create-spec A page where customers can book a time slot
/specboard:run-spec T-001
```

[Running a spec](running-specs.md) explains what happens next, and [Commands](commands.md) lists the rest.

## Or from a terminal

You can also use Spec Board with no plugin. Spec Board isn't published to npm, so run its commands from a copy of the repo:

```
npm install
npm run specboard -- init "<your project folder>"
npm run board -- "<your project folder>"
```

Use a real path in place of `<your project folder>`, without the `<` and `>`. The project should be a git repo, because a run makes one commit per subtask.

`init` does these things:

1. Creates `.specboard/` in your project, which holds your specs.
2. Copies Spec Board's commands to `.claude/skills/`, so `/plan-project`, `/run-spec` and the others work in a Claude chat there. (They have no `specboard:` prefix this way.)
3. Shows the actions a background run may use, and asks you to approve them.
4. Adds the board's list of projects and your approvals to `~/.specboard/`, outside the repo.

Then open a chat in the project folder and run `/plan-project`. It asks a few questions, writes `.specboard/config.md` and suggests your first specs as drafts.

Two things to know about this route:

- **No token counts.** They come from a hook in the plugin. A project set up with plain `init` doesn't have it.
- **`init` has options** for scripts: `--yes` (skip the questions), `--runs yes` or `--runs no` (answer the background-runs question), `--no-skills` (don't copy commands into the project) and `--force-skills` (replace the copied commands with the current ones).

## Where your files live

| Location | What's there | Commit it? |
|---|---|---|
| `.specboard/` in your project | Specs, subtask logs, overview, config, settings | Yes |
| `.claude/skills/` in your project | Copies of Spec Board's commands (terminal route only) | Your choice |
| `.claude/settings.json` in your project | Actions allowed in a chat | Your choice |
| `~/.specboard/` in your home folder | The list of projects and the actions approved for background runs | No, it's outside the repo |

To get newer commands into a terminal-route project after updating Spec Board, run `init` on it again with `--force-skills`. Without that flag, `init` keeps any copy that differs from the current one, because you may have edited it. Plugin users update the plugin instead.
