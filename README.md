# Spec Board

A local board for the work you give Claude Code. Each piece of work is a spec: a plain Markdown file in your repo. The board shows those files live, and Claude reads and updates the same files.

Code and issues: https://github.com/kingsleykbc/claude-spec-board

## Why

Following Claude's plans and progress in a terminal, or in raw Markdown, is hard. Spec Board keeps them readable at a glance:

- **To-do, Doing, Review and Done columns**, with urgency, categories and dependencies on every card. Or switch to a **table** of every spec, with its subtasks and token counts.
- **Milestones for bigger projects.** Group specs that ship together: Project, Milestone, Spec, Subtask. Small projects never need them.
- **Your files are the only source of truth.** There is no database. Edit a spec on the board, in your editor or through Claude, and the others catch up within about a second.
- **Claude asks instead of guessing.** Decisions become open questions that you answer on the card.
- **Each subtask gets a commit and a log,** with the pull request link and an approximate token count when there is one.
- **A checklist for your review.** The checks only you can do, such as trying a page on your phone, sit under **To review** on the card for you to tick.
- **Pictures for Claude.** Drop screenshots or sketches into a card's **Attachments** and Claude looks at them when it works on the spec.
- **Sync with code.** One button (or `/specboard:sync-specs`) brings the board back in line with the code. It shows what it will change and waits for your OK.
- **Works without background runs.** If Claude can't run in the background for a project, the board shows that Claude isn't connected to it, and its Claude buttons give you the command to paste into your chat instead.

## Install as a plugin

You need [Claude Code](https://code.claude.com/docs) and Node.js 22 or later (the plugin runs its board and token counter with it). In a Claude Code chat:

```
/plugin marketplace add kingsleykbc/claude-spec-board
/plugin install specboard@spec-board
```

Then open a chat in your project folder (a new project or an existing codebase) and run:

```
/specboard:setup
```

Claude looks for plans you already have, asks a few questions, shows the structure it suggests as a tree, and waits for your OK before writing anything. Then it opens the board. You can also just say "set up spec board here".

To write a spec, or start from an idea:

```
/specboard:create-spec A page where customers can book a time slot
```

The card appears on the board. Answer its required questions there, press **Run with Claude** to start a background run, or **Copy run command** and paste the command into your chat.

## Or from a terminal

You need Node.js 22 or later, git and Claude Code. Spec Board isn't published to npm, so run these from a copy of this repo, with the path of your own project, ideally a git repo:

```
npm install
npm run specboard -- init "<your project folder>"
npm run board -- "<your project folder>"
```

Then open a Claude chat in your project folder and type `/plan-project`. Without the plugin the commands have no `specboard:` prefix, and there are no token counts.

## Documentation

- [Getting started](docs/guide/getting-started.md): install the plugin, set up a project, and use the board.
- [Running a spec](docs/guide/running-specs.md): your Claude chat or the background, tokens, pull request links, sync, archiving, and how to turn background runs on.
- [Specs and questions](docs/guide/writing-specs.md): the file format, milestones, "Done when", steps for you, To review, attachments, closing steps, and required and optional questions.
- [Commands](docs/guide/commands.md): every Claude command and terminal command.
- [Safety](docs/guide/safety.md): what a run can and can't do. Read this before running a repo you don't trust.

The board shows these same pages: open the menu under the logo and choose **Documentation**.

The plugin's skills live in `plugin/skills/<name>/SKILL.md`. They are active once the plugin is installed in Claude Code.

## Contributing

To work on Spec Board itself (repo layout, tests, the plugin bundle and the frontend conventions), see [CONTRIBUTING.md](https://github.com/kingsleykbc/claude-spec-board/blob/main/CONTRIBUTING.md).
