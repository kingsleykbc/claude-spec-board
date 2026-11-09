# Safety

**Only run projects whose tests you'd be willing to run yourself.** Neither way of running a spec is a sandbox.

## In your chat

A chat run works like any other Claude Code session in that folder. Your permission prompts, settings and plugins apply. So do the project's hooks and MCP servers, which means a repo can run code through them.

## In the background

A background run starts Claude with only the list of actions you approved in `init`, kept outside the repo in `~/.specboard/`, so a repo can't widen it.

- The project's hooks, MCP servers and allow rules are ignored, and so are your own plugins, MCP servers and hooks.
- The default list has no `git push`, `git reset` or `rm -rf`, and no writes to `.claude/` or `.git/`.
- It can't ask you anything, so anything not on the list is refused and the run stops.
- `claude` is looked up by full path, and folders inside any project on the board are left out of its PATH, so a repo can't supply its own `claude`.

## What the background run doesn't protect against

- **Tests and git hooks run with your rights.** `npm test` and `git commit` run the repo's own code, so a hostile repo can do anything through them.
- **Repo text is input to Claude.** A run reads `CLAUDE.md` and the specs, so a repo can try to talk Claude into things. The approved list still decides what can run.
- **A replaced folder keeps its approval.** If you delete a repo and clone another to the same path, it inherits the approved list.

Tools inside a folder on the board, such as an activated `.venv\Scripts`, aren't available to background runs. Point the project's test command at a relative path, like `.venv\Scripts\pytest`.

## The board itself

- It only accepts requests from its own page on your machine.
- It only writes to files inside the project, and every write checks that the file hasn't changed since you loaded it.
- Clicking a file path only opens files inside the project, and only in VS Code. It never uses the system's default app, because a log can name any file, and opening a program would run it.
