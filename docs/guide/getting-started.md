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

## Open the board

```
npm run board -- "<your project folder>"
```

The board opens in your browser and stays live until you stop the command. It remembers each project, so you can switch between them from the project menu.

## Use it from Claude

Open a Claude chat in your project folder, in the terminal or the desktop app, and use the commands directly:

```
/create-spec A page where customers can book a time slot
/run-spec T-001
```

[Running a spec](running-specs.md) explains what happens next, and [Commands](commands.md) lists the rest.

### As a plugin

The commands are also packaged as a Claude Code plugin in `packages/server/kit`. In the terminal version of Claude Code you can load it for one session, without running `init`'s copy step in that project:

```
claude --plugin-dir "<this repo>/packages/server/kit"
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
