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
- **Sync with code.** One button (or `/specboard:sync-specs`) brings the board back in line with the code. It shows what it will change and waits for your OK.
- **Works without background runs.** If Claude can't run in the background for a project, the board shows that Claude isn't connected to it and gives you copy-and-paste commands instead.

## Install as a plugin

You need git, [Claude Code](https://code.claude.com/docs) and Node.js 22 or later (the plugin runs its board and token counter with it). In a Claude Code chat:

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

The card appears on the board. Answer its required questions there, press **Copy run command**, and paste the command into your chat.

## Or from a terminal

You need Node.js 22 or later, git and Claude Code. Spec Board isn't published to npm, so run these from a copy of this repo, with the path of your own project, which should be a git repo:

```
npm install
npm run specboard -- init "<your project folder>"
npm run board -- "<your project folder>"
```

Then open a Claude chat in your project folder and type `/plan-project`. Without the plugin the commands have no `specboard:` prefix, and there are no token counts.

## Documentation

- [Getting started](docs/guide/getting-started.md): install the plugin, set up a project, and use the board.
- [Running a spec](docs/guide/running-specs.md): your Claude chat or the background, tokens, pull request links, sync, and how to turn background runs on.
- [Specs and questions](docs/guide/writing-specs.md): the file format, milestones, "Done when", steps for you, closing steps, and required and optional questions.
- [Commands](docs/guide/commands.md): every Claude command and terminal command.
- [Safety](docs/guide/safety.md): what a run can and can't do. Read this before running a repo you don't trust.

The board shows these same pages: open the menu under the logo and choose **Documentation**.

## Contributing

The repo is an npm workspace: `packages/core` (the file format), `packages/server` (the CLI and the board's server) and `packages/web` (the board), plus the Claude Code plugin in `plugin/`. Run `npm install`, then `npm test` for every package, or `npm run storybook` to browse the board's components.

The plugin's skills live in `plugin/skills/<name>/SKILL.md`. They are active once the plugin is installed in Claude Code, not while you work inside this repo. `plugin/web` and `plugin/bin` are a prebuilt bundle: after changing the server or the web app, run `npm run build:plugin` and commit the result (a server test fails when the bundle is out of date).

### Frontend layout

- **One folder per component.** `packages/web/src/components/<name>/` holds `<name>.tsx`, `<name>.stories.tsx`, `<name>.test.tsx` and any helpers only it uses. Kebab-case names, no barrel files. Shared pieces and the shadcn primitives sit in `components/ui/<name>/` with the same layout. Logic stays in `lib/`, `state/` and `api/`.
- **Tailwind v4** for all styling, through `@tailwindcss/vite`. No CSS modules and no static inline styles. The colour tokens (light and dark) are CSS variables in `styles/tokens.css`; `styles/app.css` exposes them to Tailwind with `@theme inline` (`bg-card`, `text-fg2`, `border-line`, ...) and makes `dark:` follow the board's theme.
- **shadcn (Radix)** only for dropdown-menu, dialog, drawer (vaul), popover, tooltip, switch and toggle-group. Everything else is hand-written in Tailwind. `ui/responsive-menu` shows a dropdown on wide screens and a bottom drawer at 720px and under.
- **Story-based tests.** Every component folder has at least one story and one test. Tests render the stories with `composeStories` (the Storybook preview's decorators are set up in `src/test/setup.ts`) and assert with React Testing Library in Vitest: `npm test -w @specboard/web`. `npm run test:stories -w @specboard/web` runs the stories' own checks in a browser.
- **Hint nesting rule.** `ui/hint` puts a tooltip on an icon-only control. When the control is itself a stateful Radix trigger (a toggle, a switch, a menu trigger styled by `data-state`), that control is the outer `asChild` and `Hint` goes inside it: `<ToggleGroupItem asChild><Hint label="..."><button /></Hint></ToggleGroupItem>`. The other way round, the tooltip's `data-state` replaces the control's.
- **Visual checks.** `node packages/web/scripts/screens.mjs <folder>` builds the board, opens it on `examples/recipe-box` and saves screenshots of the main screens at 1280 and 375 px wide, light and dark, to compare before and after a change.
