# Spec Board

A local kanban board for the work you give Claude Code. Each piece of work is a spec: a plain Markdown file in your repo. The board shows those files live, and Claude reads and updates the same files.

## Why

Following Claude's plans and progress in a terminal, or in raw Markdown, is hard. Spec Board keeps them readable at a glance:

- **To-do, Doing, Review and Done columns**, with urgency, categories and dependencies on every card.
- **Your files are the only source of truth.** There is no database. Edit a spec on the board, in your editor or through Claude, and the others catch up within about a second.
- **Claude asks instead of guessing.** Decisions become open questions that you answer on the card.
- **Each subtask gets a commit and a log,** so you can see what happened when you review the work.

## Status

Spec Board runs from a copy of this repo. It isn't published yet, so `npx` and installing it as a plugin from a marketplace don't work today. [Getting started](docs/guide/getting-started.md) shows what works now and what is planned.

## Quick start

You need Node.js 22, git and [Claude Code](https://code.claude.com/docs). Run these from this repo, with the path of your own project, which should be a git repo:

```
npm install
npm run specboard -- init "<your project folder>"
npm run board -- "<your project folder>"
```

Then open a Claude chat in your project folder and create your first spec:

```
/create-spec A page where customers can book a time slot
```

The card appears on the board. Answer its required questions there, press **Copy run command**, and paste the command into your chat.

## Documentation

- [Getting started](docs/guide/getting-started.md): install, set up a project, and use Spec Board as a plugin or through `npx`.
- [Running a spec](docs/guide/running-specs.md): your Claude chat or the background, and which to choose.
- [Specs and questions](docs/guide/writing-specs.md): the file format, and required and optional questions.
- [Commands](docs/guide/commands.md): every Claude command and terminal command.
- [Safety](docs/guide/safety.md): what a run can and can't do. Read this before running a repo you don't trust.

The board shows these same pages: open the menu under the logo and choose **Documentation**.
