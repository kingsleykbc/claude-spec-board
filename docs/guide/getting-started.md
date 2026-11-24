# Getting started

## What you need

- git (optional, see [Without git](getting-started.md#without-git))
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

If you already had a Claude chat open, run `/reload-plugins` in it (or restart Claude) so it can see the new commands.

## Set up a project

Open a Claude chat in your project folder, a new project or an existing codebase, and run:

```
/specboard:setup
```

You can also just say "set up spec board here", or describe the project and let Claude take it from there. Copy and paste this, with your own idea:

```
use spec-board to plan a project that lets customers book a time slot
```

Claude treats what you wrote as the project notes. Setup goes through these steps, one question at a time:

1. **Where.** Which folder. If it already has a `.specboard/` folder, it tells you and offers `/specboard:structure`, an import or a sync instead.
2. **Look first.** It searches the folder for plans you already have: Spec Kit, OpenSpec, or roadmap and plan documents.
3. **Import or start fresh.** If it found plans it asks which. If not, it starts from scratch.
4. **Setup questions.** What you're building, the stack, must-have features, design references, phases ([milestones](writing-specs.md#milestones)), tests and docs after each spec, commits, and whether to keep the specs in git. Each has a suggested answer, and "skip" takes it. Questions your request already answers are skipped.
5. **Preview.** It shows the specs it would make as a tree, and waits for your OK or changes. Nothing is written before that.
6. **Set up.** It creates `.specboard/` and writes the specs as drafts.
7. **Old plan files.** After an import it asks whether to keep them or move them to `.specboard/imported/`. It never deletes them, and warns you that deleting `.specboard` later deletes the moved files too.
8. **Background runs.** It shows the actions a background run may use, and asks whether to turn runs on. If you say no, the board still works, and gives you commands to copy instead (see [When Claude isn't connected](running-specs.md#when-claude-isnt-connected)).
9. **Finish.** It summarises what it did and opens the board in your browser.

The questions are short, and each has a suggested answer. Say "skip" to take the suggestion.

If Claude is in plan mode, it puts the tree in the plan and writes nothing until you approve it.

### Without git

Git is optional. Without a git repo, or with `commits: false` in `.specboard/config.md`, a run makes no commits. Each log lists the files changed instead of a commit. Sync still works. It just can't use the git history.

### .specboard and git

When the project has a git repo, setup asks **Keep the specs in git?** (suggested: yes). Your answer goes in `.specboard/config.md` as `specs_in_git`. Either way, Claude's code commits hold only the code; it never adds `.specboard/` to them.

- **Yes** (`specs_in_git: true`). The specs are pushed with your code, so your team sees them. Claude commits `.specboard/` in a commit of its own, with only `.specboard/` in it, for example `Spec Board: T-001 to Review`. It makes one at the end of a run that moves a spec to Review, in a chat or in the background, and at the end of a command you ran in a chat that changed the specs (planning, importing, writing or moving specs, a sync, a refresh). Changes you made on the board go into the next one. It never pushes. With `commits: false` it makes no board commits either.
- **No** (`specs_in_git: false`). The specs stay on this machine. Setup adds `.specboard/` to the repo's local exclude file (`.git/info/exclude`), so git doesn't see the folder and it never shows in `git status`. It doesn't touch `.gitignore`, and the exclude file is never shared.

A project set up before this choice existed has no `specs_in_git`, and works as before: no board commits and nothing hidden. Your own commits are up to you.

To change your mind later, edit `specs_in_git` in `.specboard/config.md`, then ask Claude to run `specboard init --specs-in-git yes "<project folder>"` (or `no`). On a project that's already set up, that command only updates the exclude file: `no` adds `.specboard/`, and `yes` takes it out again. If `.specboard/` was committed before you switch to no, git keeps tracking those files until you remove them from the repo with `git rm -r --cached .specboard`.

### Removing Spec Board

Everything Spec Board keeps for a project is in `.specboard/`, so delete that folder to remove Spec Board. If you moved old plan files into `.specboard/imported/`, they go with it. Spec Board writes nothing else in your project, with one exception: if you used the terminal route, `init` copies commands into `.claude/skills/`. It also keeps a few things outside the project: the project list and approvals in `~/.specboard/`, and the plugin's token-count data.

To see the structure again later, run `/specboard:structure`. To write up a draft, run `/create-spec <ID>` (the short form works with or without the plugin).

## Open the board

Setup opens it for you. To open it again, ask Claude to "open the board" in your project folder. Claude runs `specboard` for you, a command that is on its PATH while the plugin is on. The board opens in your browser and remembers each project, so you can switch between them from the project menu.

### Board and table

The board and table icons at the left of the filter bar show the same specs two ways. The board has four columns. The table has one row per spec, with its status, progress and tokens, and each row opens to show its subtasks. Filters apply to both. For a project with milestones, the board has a milestone picker, shown like the project name with its done and total counts ("Basics · 2/3"), that starts on the current milestone; the table shows every milestone in its own section, with the columns lined up across them. The **Show archived** count follows the filters you've set, and the switch hides when nothing archived matches. Every card's ⋯ menu has **Archive** (or **Unarchive** on an archived card).

### A card's detail

Click a card to open it. The top row has the ID, the file path, the status and the ⋯ menu; the row below holds the actions, such as **Run with Claude** and **Sync**. Then come the spec, **Attachments** (images for Claude to look at), the open questions, the subtasks and **To review**, the checks for you to tick once the work is done ([more](writing-specs.md#to-review)).

### Simple mode

Turn on **Simple mode** in the header (in the logo menu on a small screen) for a quieter view. Each card shows only its ID, title, the start of its description, subtask progress and what Claude is doing right now. Everything else is one click away:

- **On a card:** press **⋯** to see whether it's blocked or has a file problem, whether it's waiting on your review, and its urgency, categories and dependencies, plus **Archive**. A red dot on **⋯** means the card is blocked or its file has a problem.
- **Above the board:** the "to review", "questions for you" and "blocked" counts move behind **⋯** on the right. A dot on it means something is waiting on you.
- **In a card's detail:** urgency, categories and dependencies move behind **⋯** next to the status. You can still change them there.
- **In the header:** References and Overview move into the logo menu. Logs stays at the right end of the header.

The board remembers your choice in this browser, for every project.

### The header and the logo menu

- A small dot next to the project name shows the connection: green is connected, amber is reconnecting, red is disconnected. In the project list, a green dot means that project's folder can be reached and grey means it can't.
- **References**, **Overview** and **Logs** each have an icon. **Overview** shows a summary, the counts, the total tokens used and a table of every spec. **Logs** shows every subtask log in the project, newest first, with a search box. **References** lists the documents the project points Claude at. From left to right, the header has the "not connected" icon (when it shows), **References**, **Overview**, the **Simple mode** switch and **Logs**. Logs is always the last button on the right.
- If Claude can't run in the background for this project, a small "not connected" icon sits in the header. Hover it (or focus it with the keyboard, or tap it on a phone) to see **Claude isn't connected to the board** and why. The buttons that would start Claude are greyed out then; hover or press one to get the command to paste into your chat ([more](running-specs.md#when-claude-isnt-connected)).
- The menu under the logo holds **Documentation**, **Take the tour**, **Sync with code** (and **Sync proposal waiting** when one is waiting) and **Settings**. In Simple mode, and on small screens, it also holds References and Overview, and on small screens the **Simple mode** switch. **Theme** is last: **Light**, **Dark** or **System** (the default, which follows your computer's setting).
- Buttons that show only an icon name themselves when you hover or focus them. Icons that carry information, such as a warning on a log or a waiting marker, open a small popup when you hover them or focus them with the keyboard, and on a tap on phones.
- On a small screen the board scrolls sideways one column at a time, the card detail fills the screen, and the header's extra buttons join the logo menu. Category, urgency and **Blocked only** move into a **Filters** button above the board (its badge counts the active ones), and menus open as panels from the bottom of the screen.

### The Overview

**Overview** in the header opens a page about the whole project: its name and description, a progress ring, the counts per column, the tokens used (when token tracking is on), a **Summary** and a **Tasks** table of every spec.

- **The summary** is a quick status report in plain words, one to three short paragraphs: what the project is, what has been done, what is in progress, what comes next, and anything waiting on you (questions to answer, work to review, checks that failed). It names the work, not card IDs or files. **Refresh** asks Claude to write it again from the current specs ([how it runs](running-specs.md#the-other-claude-buttons-on-the-board)).
- **Out of sync.** While it refreshes the summary, Claude also checks, without changing anything, whether the board and the code still agree, the same way [Sync with code](running-specs.md#sync-with-code) does. When they don't, a warning box at the bottom of the summary says what looks off, for example "Two cards look further along in the code than on the board.", with a **Sync** button. It does exactly what **Sync with code** in the logo menu does. Once a whole-project sync is applied, the warning goes away. Without git, or when the check can't run, there is no warning.
- **Export .md** downloads the overview as a Markdown file.

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

Use a real path in place of `<your project folder>`, without the `<` and `>`. A git repo is best, because a run makes one commit per subtask (see [Without git](getting-started.md#without-git)).

`init` does these things:

1. Creates `.specboard/` in your project, which holds your specs.
2. Copies Spec Board's commands to `.claude/skills/`, so `/plan-project`, `/run-spec` and the others work in a Claude chat there. (They have no `specboard:` prefix this way.)
3. Shows the actions a background run may use, and asks you to approve them. It doesn't write `.claude/settings.json`.
4. Adds the board's list of projects and your approvals to `~/.specboard/`, outside the repo.

Then open a chat in the project folder and run `/plan-project`. It asks a few questions, writes `.specboard/config.md` and suggests your first specs as drafts.

Two things to know about this route:

- **No token counts.** They come from a hook in the plugin. A project set up with plain `init` doesn't have it.
- **`init` has options** for scripts: `--yes` (skip the questions), `--runs yes` or `--runs no` (answer the background-runs question), `--specs-in-git yes` or `--specs-in-git no` (hide `.specboard/` from git on this machine, or stop hiding it; see [.specboard and git](getting-started.md#specboard-and-git)), `--no-skills` (don't copy commands into the project) and `--force-skills` (replace the copied commands with the current ones).

## Where your files live

| Location | What's there | Commit it? |
|---|---|---|
| `.specboard/` in your project | Specs, subtask logs, images, overview, config, settings | Yes |
| `.claude/skills/` in your project | Copies of Spec Board's commands (terminal route only) | Your choice |
| `~/.specboard/` in your home folder | The list of projects and the actions approved for background runs | No, it's outside the repo |

To get newer commands into a terminal-route project after updating Spec Board, run `init` on it again with `--force-skills`. Without that flag, `init` keeps any copy that differs from the current one, because you may have edited it. Plugin users update the plugin instead.
