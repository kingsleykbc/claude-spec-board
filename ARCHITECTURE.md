# Architecture

How Spec Board is built, for developers working on it. For what it does and why, see the [README](README.md) and the user guide in [docs/guide/](docs/guide/). For the house rules on components and tests, see [CONTRIBUTING.md](CONTRIBUTING.md).

## The big picture

Spec Board is a **local web board over Markdown files**, plus a **Claude Code plugin** that writes and works those files.

```
 Claude Code chat ──skills──▶ .specboard/*.md ◀──read/write── server (Node, Hono) ◀──HTTP + WS── board (React)
                                    ▲                              │
                                    └──── background runs ─────────┘  (server spawns `claude -p`)
```

- **The files are the source of truth.** There is no database. Every spec, log, question and answer lives in `<project>/.specboard/`. The board and Claude both read and write the same files, and either can change them at any time.
- **The server** watches those files, serves the board, applies board edits to the files, and can start Claude in the background.
- **The board** is a single-page React app. It shows one project at a time and reloads when the files change.
- **The plugin** gives Claude the skills (`/specboard:create-spec`, `run-spec`, and so on) and ships a prebuilt copy of the server and board.

Everything runs on the person's machine, on `127.0.0.1` only.

## Repo layout

```
.claude-plugin/marketplace.json   Marketplace "spec-board" → plugin in ./plugin
packages/
  core/      @specboard/core: the file format (parse, edit, write). No I/O beyond fs reads/writes.
  server/    @specboard/server: CLI (`specboard`), HTTP API, WebSocket, file watching, Claude runs.
  web/       @specboard/web: the board (React 19 + Vite).
plugin/
  .claude-plugin/plugin.json      Plugin "specboard"
  skills/<name>/SKILL.md          The 16 skills (the Claude side of the product)
  hooks/hooks.json                PostToolUse hook for token counts
  bin/specboard(.cmd|.mjs)        GENERATED: bundled CLI + server
  web/                            GENERATED: built board
scripts/build-plugin.mjs          Builds plugin/bin and plugin/web
examples/recipe-box/              Sample project used for manual checks and screenshots
docs/guide/                       User guide (also shown in the board at /docs)
```

It is an **npm workspaces** monorepo (`packages/*`). The packages are TypeScript run straight from source: `core` exports `./src/index.ts`, and the server runs with `tsx` in development. Only the plugin bundle and the web build are compiled.

## Tools

| Area | Tools |
|---|---|
| Language | TypeScript 5.9, `strict` + `noUncheckedIndexedAccess`, ES2023, NodeNext modules (`tsconfig.base.json`) |
| Runtime | Node 22+ (the bundle targets `node22`) |
| Server | Hono 4 on `@hono/node-server`, `ws` (WebSocket), `chokidar` 4 (watching), `yaml`, `get-port`, `open`, `cross-spawn`, `tree-kill` |
| Web | React 19, Vite 7, Tailwind CSS v4 (`@tailwindcss/vite`), shadcn/Radix (dialog, dropdown-menu, popover, tooltip, switch, toggle-group), `vaul` (drawers), `@dnd-kit/core` (drag and drop), `react-markdown` + `remark-gfm`, `react-icons` (Lucide set), `driver.js` (first-run tour) |
| Tests | Vitest 3 everywhere. Web: happy-dom + React Testing Library + `composeStories`. Storybook 9 with `@storybook/addon-vitest` (Playwright) for in-browser story checks |
| Bundling | esbuild (server → one `.mjs`), Vite (web) |

**Formatting and linting.** There is no Prettier or ESLint config. The gates are `tsc` (strict, run by the web build) and the tests. Match the existing style:
- 2-space indent, single quotes and semicolons;
- long lines are fine (about 120–150 columns);
- short `/** … */` comments that say *why*;
- no barrel files in `web`.

Git normalises line endings to LF (`.gitattributes`), except `plugin/bin/*.cmd`, which is CRLF. Generated plugin files are marked `linguist-generated` and `-diff`.

## Commands

| Command | What it does |
|---|---|
| `npm install` | Install all workspaces |
| `npm test` | Every package's Vitest suite (core, server, web unit tests) |
| `npm run board -- <project> [--port N] [--no-open]` | Build the web app and start the board on a project from source (default port 4949) |
| `npm run web:dev` | Vite dev server on 5173; proxies `/api` and `/ws` to a server on 4949 |
| `npm run storybook` | Storybook on 6006 |
| `npm run test:stories -w @specboard/web` | Run the stories' own checks in a real browser |
| `npm run test:claude` | Tests against the **real** `claude` CLI (opt-in, spends tokens) |
| `npm run build:plugin` | Build the web app, bundle the server into `plugin/bin`, copy the web build into `plugin/web` |
| `node packages/web/scripts/screens.mjs <out>` | Screenshots of the main screens (1280 and 375 px, light and dark) on the sample |

**Always rebuild the plugin after changing the server or web, and commit the result.** `packages/server/test/bundle.test.ts` fails when the sources are newer than the bundle.

## The file format (`packages/core`)

A project's data:

```
<project>/.specboard/
  config.md            name, created, references, milestones, closing_steps, commits, test_command (front matter) + notes
  settings.md          per-project settings (track_tokens)
  overview.md          project summary written by /specboard:refresh-overview
  sync-proposal.md     pending sync plan (written by sync-specs --dry-run, read by the board)
  specs/<ID>-<slug>/
    spec.md            front matter + ## Spec, ## Features, ## Done when, ## Open questions, ## Subtasks, ## To review
    logs/<n>-<slug>.md one log per finished subtask (summary, files, commit, PR, tokens)
    images/            images the spec links to with relative paths, plus attachments (images it doesn't link)
  archive/<ID>-<slug>/ archived specs, same layout
  imported/            old plan files moved in by setup (never deleted)
```

`spec.md` front matter holds:
- `id`, `title`, `status` (`todo|doing|review|done`) and `urgency` (`low|normal|high|urgent`);
- `categories`, `depends_on` and `milestone`;
- `draft`, `current_subtask` and `needs_refresh`;
- `created` and `updated`.

Open questions are typed (`yesno`, `number`, `text`, `choice`), and answers are written back into the same file. A subtask is a numbered checkbox line; a matching log file means it has been worked. `## To review` holds the person's after-work checks: unnumbered `- [ ]` lines (`REVIEW_LINE`), each with an optional `  > expected:` line, grouped by optional `### ` headings, parsed into `SpecDoc.reviews`. Only the person ticks them (`setReviewDone`); they don't count toward progress or move the card, and `specBodyMd` leaves them out of the editable body. `Spec.images` lists the image files in `images/`, and `Spec.attachments` the ones spec.md never references (`referencesImage`).

Core is split into the following parts:
- **Parse:** `frontmatter.ts`, `sections.ts`, `parseSpec.ts` and `parseOther.ts` (config, settings, overview, logs). Parsing never throws on bad input. It collects `problems: string[]`, which the board shows as "file problem" cards.
- **Load:** `project.ts` `loadProject(root)` reads everything into a `Project`. That covers specs, archived specs, config, settings, overview and derived state such as blocked-by and waiting, and `deriveState` works the derived state out.
- **Edit:** `edit.ts` makes pure text-to-text changes, such as `setMetaField`, `setSubtaskDone`, `setReviewDone`, `setAnswers`, `replaceSpecBody` and `setNeedsRefresh`. These change only the targeted lines and keep key order, comments and the file's line endings, so files stay diff-friendly and hand-editable.
- **Write:** `write.ts` `writeIfUnchanged(file, baseHash, transform)` does optimistic concurrency. The client sends the hash it last saw; on a mismatch the write is refused (the board shows a conflict dialog). Writes go to a temp file followed by a rename, serialised per file in-process (`lock.ts`), with a retry for Windows file locks (`retry.ts`).
- **Other:** `tree.ts` (text tree for `specboard tree`), `milestones.ts`, `you.ts` (subtasks tagged `(you)`), `slug.ts` and `hash.ts`.

When a format rule changes, update core, the `specboard` skill's format section and `docs/guide/writing-specs.md` together.

## The server (`packages/server`)

**Entry and start-up.** `cli.ts` is the `specboard` command. Its subcommands are:
- `specboard <folder>` starts or reuses the board;
- `init` sets up `.specboard/` and the background-run permissions;
- `allow <rule>` adds an allowed command;
- `tree` prints the board as a tree;
- `archive <ID> [folder]` archives a spec from any status through core's `archiveSpec` (skills run it after the person's OK; it has no access to the board's run lock, so only the board's archive route refuses a spec a run is working on);
- `hook-tokens` is called by the plugin hook;
- `--detach` re-spawns itself in the background.

`start.ts`:
- If a Spec Board already answers on the port (`/api/health` says `app: specboard`), it registers the project with it and opens the browser.
- Otherwise it starts a new server. It binds `127.0.0.1` only.

**Projects.** `registry.ts` keeps known projects in `~/.specboard/projects.json` (or `$SPECBOARD_HOME`). A project's id is the first 8 hex characters of the sha1 of its lowercased path. One server serves many projects; the board picks one with `?project=<id>`.

**HTTP API** (`app.ts` + `routes/`). Every route is under `/api/projects/:pid/...`:

| Route file | Covers |
|---|---|
| `specs.ts` | meta, subtask ticks, To review ticks (`PATCH /specs/:id/reviews/:n`), answers, body (sets `needs_refresh` when the text really changed), create, draft copy, archive (any status; 409 while a run works on that spec)/unarchive, settings |
| `references.ts` | reference docs list, content, link, create, delete, file picker |
| `files.ts` | open a file in VS Code (`open-file`) |
| `images.ts` | serve an image from inside the project (`?path=`): extension allowlist, `nosniff`, CSP `sandbox` for SVG |
| `uploads.ts` | `POST /specs/:id/images`: save a pasted or dropped image (JSON `{ name, data }`, base64) into the spec's `images/` folder: 10 MB limit (413), same extension allowlist (400), slugified name, `-2`, `-3` when taken. `DELETE /specs/:id/images/:name` removes an attachment (never touches spec.md; 409 when archived) |
| `sync.ts` | read/discard `sync-proposal.md` |
| `runs.ts` | start/stop/dismiss background runs, run + Claude status |

Every write goes through core's `writeIfUnchanged`. The app also serves the built board, with an SPA fallback to `index.html`.

**Live updates.** `watch.ts` watches each project's `.specboard/` and its reference files with chokidar, ignoring `*.tmp` and `*.draft.md`. It debounces changes into one `onChange`. `hub.ts` is a WebSocket hub at `/ws`: clients subscribe to a project id and receive `project-changed` and run events. The board refetches the project on `project-changed`. It doesn't patch state from the event.

**Security.** These rules are load-bearing, so keep them when adding routes:
- `security.ts` `guard`: the Host header must be `127.0.0.1:<port>` or `localhost:<port>`, which stops DNS rebinding. Mutating requests and WebSocket upgrades must have no Origin or the server's own origin. Every mutating `/api` call must be `Content-Type: application/json`, so a cross-site form can't send one without a CORS preflight, which is never answered.
- `safePath.ts` `safeProjectPath` / `safeProjectFile`: any path from a client or a file is resolved inside the project root. It rejects `..`, absolute and UNC paths and symlink escapes.
- `claude/resolve.ts` and `claude/status.ts`: `claude` is found by absolute path, never from inside a registered project. This stops a repo shipping a fake `claude.cmd` or `node.cmd` that would run with the person's rights. Child processes get a cleaned environment (`childEnv`).

## Claude integration

There are three ways Claude and the board meet.

### 1. Skills in a chat (the main path)

The person runs `/specboard:<skill>` in their own Claude Code chat. Skills are plain Markdown instructions in `plugin/skills/`. Each loads the shared `specboard` skill first, which holds the file format and the rules. The skills edit `.specboard/` files directly with Claude's normal tools, and the board picks up the changes through the watcher. Chats run with the person's own settings, hooks and permissions.

| Skill | Purpose |
|---|---|
| `specboard` | Shared rules and file format (loaded by every other skill) |
| `setup` | Set up a project: find existing plans, import or start fresh, preview the tree, open the board |
| `plan-project`, `import-specs`, `structure`, `reorganize`, `sync-specs`, `correct-specs` | Create and reshape the set of specs and milestones |
| `create-spec`, `update-spec`, `refresh-questions` | Write or change one spec (`refresh-questions` makes a minimal update after a board edit) |
| `run-spec`, `next` | Work a spec's subtasks (one log per subtask), suggest what to do next |
| `refresh-overview`, `refresh-logs` | Rewrite `overview.md`, fill in missing logs |

Skills that a background run calls take a `--board` flag. It means "no one is in the chat: don't ask questions, write them into the file".

### 2. Background runs from the board

The board's run buttons call `POST /runs`, and `claude/runs.ts` `RunManager` spawns:

```
claude -p "<fixed prompt>" --output-format stream-json --verbose --permission-mode dontAsk \
       --setting-sources "" --plugin-dir <plugin> --settings '{"permissions":{allow,deny},"disableAllHooks":true}'
```

- **Isolated.** The empty `--setting-sources` drops the person's and the project's settings, hooks, MCP servers and CLAUDE.md. Only the approved allow/deny lists and the Spec Board plugin apply.
- **Approval first.** Runs refuse to start until the person approves the lists for that project with `specboard init --runs yes`, which `/specboard:setup` runs. Approvals live in `~/.specboard/permissions.json` (`setup.ts` `ApprovedPermissions`), outside every project, so a spec can't tell Claude to widen its own rules.
- **Fixed prompts.** `runPrompt(kind, specId)` builds prompts only from fixed strings and a validated spec ID. The kinds are `run`, `write-up`, `fix-file`, `refresh-overview`, `refresh-questions`, `sync-plan` and `sync-apply`.
- **One run per project.**
- **Streaming.** `claude/events.ts` parses the stream-json output into run lines and sends them over the WebSocket. `claude/classify.ts` decides how a run ended (finished, needs you, permission denied, error). For a denial it suggests a safe allow rule, never for interpreters, git config, hooks and so on, nor anything that overlaps a deny rule.
- **Not installed or not approved.** The board shows a not-connected marker (`web/src/state/runUi.ts` `manualReason`), and every button that would start Claude (Run with Claude, Have Claude write this up, Overview Refresh) becomes a greyed `NotConnectedTrigger`: still focusable, it opens a popover with the reason and the chat command to copy.

### 3. Token counts

- **In chats,** the plugin's `PostToolUse` hook (`plugin/hooks/hooks.json`) runs `specboard hook-tokens` after every Write/Edit. When the file written is a subtask log, `hookTokens.ts` adds the tokens spent since the last checkpoint to that log's `tokens:`. It reads them from the chat transcript and counts each message once.
- **In background runs,** hooks are off, so `claude/logTokens.ts` counts the same way from the run's stream.
- **Turning it off:** both respect `track_tokens` in `settings.md`.

### Without the plugin

`specboard init` (run from the repo) can copy the skills into `<project>/.claude/skills/` instead (`kit.ts`, never `setup`). Spec Board writes nothing in a project outside `.specboard/`, with these exceptions: that `.claude/skills/` copy (opt-in), the person's own `~/.specboard` (the project list and approvals) and the plugin's token-count data folder. It never writes `.claude/settings.json`.

## The board (`packages/web`)

```
src/
  main.tsx, App.tsx        boot, theme, routing (board vs /docs), top-level layout
  api/client.ts            typed fetch wrapper for every route (ApiError, ConflictError)
  api/live.ts              WebSocket with reconnect → 'live' | 'reconnecting' | 'disconnected'
  state/                   hooks and pure logic: useProject (load + live diff), mutate (hash-checked writes),
                           actions, useRun/runUi, filters, viewMode, simpleMode, toasts, allLogs, fileLinks
  lib/                     pure helpers: vm.ts (view-model: labels, colours, block reasons), icons.ts (all icons),
                           image-src, theme, tour, docsPages (README + docs/guide bundled with ?raw), ...
  components/<name>/       one folder per component: <name>.tsx + .stories.tsx + .test.tsx
  components/ui/<name>/    shared pieces and shadcn primitives, same layout
  styles/tokens.css        colour tokens (light + dark) as CSS variables; app.css maps them into Tailwind
```

- **Data flow.** `useProject(pid)` fetches the whole project, subscribes to live updates and diffs old and new to briefly highlight changed cards. Edits go through `createMutator`: send the last hash, apply the returned spec, and on 409 show the conflict dialog.
- **Logic lives outside components.** Logic goes in `state/` and `lib/`, so it can be tested without rendering. Components stay presentational where possible.
- **Development.** `npm run web:dev` proxies `/api` and `/ws` to a server on 4949. The proxy rewrites Origin only for requests from the board itself (`lib/devProxy.ts`), so the server's origin guard still applies.

See [CONTRIBUTING.md](CONTRIBUTING.md) for component layout, Tailwind/shadcn rules, the `Hint` nesting rule and story-based tests.

## Testing

| Package | Where | Notes |
|---|---|---|
| core | `packages/core/test/*.test.ts` | Parsing and editing against fixtures; edits must keep the rest of the file byte-for-byte |
| server | `packages/server/test/*.test.ts` | Routes via `app.fetch`, real temp project folders, a **fake `claude`** (`fixtures/fake-claude.mjs`) that replays recorded stream-json (`fixtures/claude/*.jsonl`). `real-claude.test.ts` runs only under `npm run test:claude` |
| web | `src/**/*.test.ts(x)` | Unit tests for `state/` and `lib/`; component tests render the component's stories with `composeStories` |

The normal suite never starts the real `claude`.

## Making common changes

- **New API route:** add a file in `server/src/routes/`, mount it in `app.ts`, and resolve paths with `safeProjectPath`. Writes go through `writeIfUnchanged`. Add a method to `web/src/api/client.ts`, a server test, then run `npm run build:plugin`.
- **New spec field:** add it to the types and parser in core, add an edit helper if the board changes it, document it in the `specboard` skill and `docs/guide/writing-specs.md`, then update the board.
- **New skill:** add `plugin/skills/<name>/SKILL.md` with `name`, `description` and `argument-hint` front matter. Have it load the `specboard` skill first and add it to `docs/guide/commands.md`. If the board starts it, add a `RunKind` and a fixed prompt in `runPrompt`, mirrored in `web/src/api/client.ts`.
- **New component:** add a folder with `.tsx`, `.stories.tsx` and `.test.tsx` (see CONTRIBUTING).
- **Releasing:** run `npm test`, then `npm run build:plugin`, and commit `plugin/bin` and `plugin/web`. Bump `plugin/.claude-plugin/plugin.json` `version` so installed plugins update.
