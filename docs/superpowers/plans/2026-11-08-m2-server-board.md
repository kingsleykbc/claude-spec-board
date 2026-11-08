# Milestone 2: Server + Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `npm run board -- <project-path>` opens a local board in the browser for that project. It shows every spec live from disk, writes every UI edit back to the files through `@specboard/core`, and matches the Claude Design prototype screen by screen. The buttons that trigger Claude are present but call a stub until M3.

**Architecture:** There are two new workspace packages.
- **`@specboard/server`** is a Hono app (`createApp`) plus a CLI. It owns a project registry in the user's home folder, REST endpoints that wrap core functions (each write carries the base hash), a chokidar watcher, and a WebSocket that tells clients when a project changed. It serves the built web app.
- **`@specboard/web`** is a React + Vite single-page app built from `docs/design/`, with Storybook stories for every component state. It holds one project snapshot from the REST API and re-fetches it when the WebSocket says the project changed.

**Tech Stack:** Node ≥ 22, TypeScript (strict, ESM), Hono with `@hono/node-server`, `ws`, `chokidar` 4, `open`, `get-port`; React 19, Vite, `@dnd-kit/core`, `react-markdown` + `remark-gfm`; Storybook 9 with `@storybook/addon-vitest`; Vitest and Testing Library. Pin exact versions that are at least two weeks old.

**Spec:** [`docs/documentation.md`](../../documentation.md). This plan relies on §5 (screens), §7 (sync), §10 (moving cards), §11 (projects) and §12 (tech). The visual and behaviour source of truth is the prototype [`docs/design/Spec Board.dc.html`](../../design/Spec%20Board.dc.html) (with `SpecCard.dc.html` and `Markdown.dc.html`). Also read [`m1-followups.md`](../m1-followups.md) and the [roadmap](2026-11-08-roadmap.md).

## Global Constraints

- **No database.** All state is in the project's files, plus `~/.specboard/projects.json` for the list of known projects.
- **Every write goes through core with the base hash.** If the file changed on disk, the server returns `409` with the current text. The UI never overwrites silently (§7).
- **The server listens on `127.0.0.1` only.** Every `/api` and `/ws` request must have a `Host` of `127.0.0.1:<port>` or `localhost:<port>`. Every mutating request and WebSocket upgrade must also have an `Origin` that is absent or equal to the board's own origin. Anything else is rejected with `403`.
- **File paths must stay inside the project root.** Any path from a client (reference link or create, file listing) is resolved and rejected with `400` if it leaves the root, is absolute, or contains `..` after normalisation (Windows and POSIX).
- **Windows 11 is the main platform.** Use `node:path` everywhere. Ignore `*.tmp` in the watcher, and retry reads on `EBUSY`/`EPERM`.
- **The UI copies the prototype.**
  - CSS tokens are copied as they are into `packages/web/src/styles/tokens.css`, with Geist and Geist Mono from Google Fonts.
  - Layout, sizes, copy text, icons (`○ ◐ ◆ ✓ !`, urgency bars, `⤴ ⤵`, `≡ Log`) and the empty-state wording come from `Spec Board.dc.html`.
  - Where this plan and the prototype differ, the prototype wins on looks and this plan wins on behaviour and data.
- **Default port is `4949`.** If that port is taken by something that isn't a Spec Board server, the CLI picks a free port.
- **Claude-triggering actions in M2 call `POST /api/claude/<action>`, which returns `501 { stub: true }`.** The actions are Run, Stop, "Have Claude write this up", "Add & have Claude write it up", "Ask Claude to fix" and Refresh summary. The UI shows the toast `"Claude actions arrive in the next milestone"`. Each button's own UI states (for example the run-output panel) are still built and covered by stories.
- **Only the human moves cards to Done.** The status menu labels Done as "Approve".

## Behaviour pinned from the prototype (not in the design doc)

These come from reading the prototype's logic. They are requirements.

1. **Card sort within a column:** by urgency (urgent, high, normal, low), then by numeric ID.
2. **Card description:** the first paragraph of `specMd`, clamped to 2 lines.
3. **"Waiting" items at the right of the filter bar:**
   - `"<n> to review"` opens the first Review card.
   - `"<n> question(s) for you"` opens the first card with unanswered questions.
   - `"<n> blocked"` toggles the Blocked-only filter.

   Each item is hidden when its count is 0.
4. **Filters:**
   - Category (checkbox list with counts) and Urgency (checkbox list) combine with AND across groups and OR within a group.
   - "Blocked only" is a switch.
   - Active filters show as removable chips plus "Clear".
   - Filters reset when you switch projects.
5. **Done column:** a `Show archived (n)` / `Hide archived (n)` toggle in its header. Archived cards show at 62% opacity. A Done card's `⋯` menu offers Archive or Unarchive.
6. **Review column:** a "Needs you" label in the header when it isn't empty. The column background uses `--review-soft`.
7. **Card detail header:**
   - spec ID, file path (relative to the project), the Run button (and its states), the status menu (with the note "Current" or "Approve"), and close
   - then the title (26/600), an urgency segmented control, and category chips with `×`
   - "+ Category" opens an input with suggestions from the project's categories, plus `Create "<x>"`
8. **Blocked banner:** reasons are clickable.
   - `"Awaiting answers on: <labels>"` scrolls to Open questions.
   - `"Waiting on <ID> <title> (<Status>)"` scrolls to Dependencies.

   Either way the target section's border flashes accent for 1.6 s. **The question label is the question text, cut to 40 characters with `…`** (our file format has no short label).
9. **Open questions:**
   - Each row shows a state: "Needs answer" (review ink, `--review-soft` row), "✓ Answered" (done ink), or "● Unsaved" (accent ink).
   - A question that first appears through a live update during this session gets a **New** badge until the answers are saved.
   - Save changes is disabled until something changes. Its label goes "Saving…" → "✓ Saved", and the hint reads "Claude will pick these up on its next run".
   - Number questions have no unit suffix.
10. **Subtasks:**
    - The header shows `"<d> of <n> done"` and an 80 px bar, which turns green when complete.
    - `≡ Log ▾` expands the log **inline** under the row. It shows LOG · READ ONLY entries (time formatted as `Nov 7, 15:12`), FILES CHANGED, and COMMIT.
11. **Conflict dialog** (when a section edit or reference edit gets a 409). The title is "This spec changed outside the board" and the actions are:
    - **Keep editing**
    - **Reload & keep my copy**, which writes the unsaved text to `spec.draft.md` in the spec's folder, or `<name>.draft.md` beside a reference
    - **Reload** (primary)
12. **Toasts:**
    - bottom-left, at most 4, each dismissed after 4.5 s
    - kinds `ok ✓`, `run ▶`, `info ●`, `warn ?`, `err !`, with the prototype's colours
    - copy matches the prototype, e.g. `"Answers saved" / "Written to <path>"`, `"<ID> moved to <Status>"`, `"<ID> approved" / "Moved to Done."`
13. **Live highlight:** a card or subtask row that changes through a live update flashes `--accent-soft` for 1.8 s.
14. **Esc closes, in this order:** dialog → reference add menu → category input → open menus → modal.
15. **Connection:**
    - The top bar shows `Live` (green dot), `Reconnecting…` (spinner) or `Disconnected` (red dot).
    - When not live, a banner shows the prototype's copy, with a Reconnect button when disconnected.
    - Mutations are disabled while disconnected.
16. **Project switcher:**
    - Lists the registered projects with name, path and progress (`"<done>/<total> done"`, archived included and counted as done, or `"No specs yet"`).
    - "Open another project folder…" shows the toast `"Run spec-board in a project folder"` / `"It will appear in this list."`
17. **Overview:**
    - name (34/600), description, and a progress ring of done over total, where archived specs count as done
    - status counts plus a Blocked count
    - PROGRESS with "Last updated <relative>", taken from `overview.md`'s `updated`
    - Refresh (stub)
    - Export .md downloads `<slug(name)>-overview.md`, made up of a `# <name>` heading, the description, the counts list, and the summary
18. **References:**
    - Tabs (mono, min-width 132 px) with scroll arrows `‹ ›` when they overflow.
    - The active document is rendered with its path above it. Edit opens a split editor with live preview.
    - "Remove from list" opens a confirm dialog ("This removes the link only…").
    - "+ Add" offers:
      - **Link an existing file**: a path input that suggests project `.md` files not already linked.
      - **Create a new document**: the name is uppercased and `.md` added, it's saved as `docs/<NAME>.md` with the content `# <NAME>\n\n`, and it opens in edit mode.
19. **Add spec:**
    - The header shows the next ID.
    - Title is required; both buttons are disabled at 45% opacity until a title is entered.
    - An empty description is saved as "No description yet."
20. **Theme:** follows `prefers-color-scheme` on first load. The toggle (`☾`/`☀`) is remembered in `localStorage` under `specboard.theme`, wrapped in try/catch.

## Review Focus

1. **A malicious web page posting to `http://127.0.0.1:4949/api/...`** (CSRF / DNS rebinding) must get `403` and change no file. Tests are in Task 2.
2. **Reference paths that escape the project** must give `400` and touch nothing. Examples: `../../secrets.md`, `C:\Windows\x.md`, `/etc/passwd`, `docs/../../x.md`. Tests are in Task 4.
3. **Rapid clicks on one spec** (ticking three subtasks in under 200 ms, or changing status then urgency) must all stick. The client serialises mutations per spec and sends each with the hash returned by the previous one. Tests are in Task 7.
4. **A burst of file events** (Claude rewriting many files, `.tmp` files from atomic writes) gives at most one `project-changed` event per 150 ms per project and none for `*.tmp`. If the spec you have open is deleted or archived, the modal shows "This spec was removed or archived" with a Close button instead of crashing. Tests are in Tasks 5 and 11.
5. **The server stops or restarts while the board is open:**
   - the WebSocket reconnects with backoff (0.5 s, 1 s, 2 s, then every 4 s)
   - the banner shows Reconnecting… or Disconnected
   - edits are disabled while disconnected
   - the project is re-fetched on reconnect

   Tests are in Task 7.

---

### Task 1: Core additions for the board

**Files:**
- Modify: `packages/core/src/edit.ts`, `packages/core/src/project.ts`, `packages/core/src/write.ts`
- Create: `packages/core/src/config.ts`
- Test: `packages/core/test/m2-additions.test.ts`

**Interfaces:**
- Produces:
  - `specBodyMd(text: string): string`: the body Markdown without the `## Open questions` and `## Subtasks` sections. Front matter is excluded. The Spec heading line is dropped, so its paragraph comes first, and the other sections keep their headings. This is what the SPEC panel shows and edits.
  - `replaceSpecBody(text: string, md: string): string`: replaces everything `specBodyMd` returned and keeps front matter, Open questions and Subtasks byte-for-byte. Any `## Open questions` or `## Subtasks` heading inside `md` is demoted to `###`. Other `##` headings (Features, Notes) are allowed. Line endings follow the file's existing ones.
  - `setConfigReferences(text: string, refs: string[]): string`: edits only the `references:` key of `config.md`, as a flow list.
  - `compareIds(a: string, b: string): number`: numeric comparison by ID.
  - `loadProject` read retry: up to 5 tries, 50 ms apart, on `EBUSY`/`EPERM`.
  - `writeSiblingDraft(file: string, text: string): Promise<string>`: writes `<dir>/<base>.draft.md`, overwriting any existing draft, and returns the path.
  - `Spec` gains `bodyMd: string`, which `loadProject` fills with `specBodyMd(text)`. The UI's SPEC panel shows it, and every server response that returns a spec includes it.

- [ ] **Step 1: Write the failing tests:**
  - `specBodyMd` of the T-104 sample starts with its first paragraph, contains `## Features` and `## Notes`, and contains neither `Open questions` nor `Subtasks`.
  - `replaceSpecBody(t, specBodyMd(t))` equals `t` byte-for-byte, on both LF and a CRLF copy.
  - Replacing with `'New intro\n\n## Features\n- a'` changes nothing from `## Open questions` onward, and `parseSpec(...).featuresMd === '- a'`.
  - An `md` containing `## Subtasks\n- [ ] 1. x` doesn't change the parsed subtasks.
  - `setConfigReferences(cfg, ['CLAUDE.md','docs/X.md'])` changes only the references line or lines.
  - `['T-1000','T-999','T-101'].sort(compareIds)` → `['T-101','T-999','T-1000']`.
  - `writeSiblingDraft('<tmp>/spec.md','x')` → `'<tmp>/spec.draft.md'`, containing `x`.
- [ ] **Step 2:** Run `npm test -w @specboard/core`. Expected: the new tests FAIL.
- [ ] **Step 3:** Implement the functions. `replaceSpecBody` keeps the `## Spec` heading line if it exists, then writes `md`, then the untouched Open questions and Subtasks blocks in their original order. Section order: Spec body sections first, then the two kept sections.
- [ ] **Step 4:** Run `npm test -w @specboard/core` and `npx tsc -p packages/core --noEmit`. Expected: all PASS.
- [ ] **Step 5:** Commit: `feat(core): spec body edit, config references, compareIds, read retry, draft copies`.

---

### Task 2: Server skeleton: app factory, security, registry, read endpoints

**Files:**
- Create: `packages/server/package.json` (`@specboard/server`, private, `type: module`, dependencies `@specboard/core` `*`, `hono`, `@hono/node-server`; dev dependencies `vitest`, `tsx`, `typescript`, `@types/node`)
- Create: `packages/server/tsconfig.json`
- Create: `packages/server/src/app.ts`, `packages/server/src/security.ts`, `packages/server/src/registry.ts`
- Test: `packages/server/test/app.test.ts`, `packages/server/test/registry.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // registry.ts
  export interface ProjectEntry { id: string; name: string; root: string }   // id = first 8 hex chars of sha1(lowercased resolved root)
  export class Registry { constructor(file: string); list(): Promise<ProjectEntry[]>; add(root: string): Promise<ProjectEntry>; get(id: string): Promise<ProjectEntry | null> }
  // security.ts
  export function guard(port: () => number): MiddlewareHandler   // Host/Origin rules from Global Constraints
  // app.ts
  export interface AppDeps { registry: Registry; port: () => number; webDist: string | null; claude?: ClaudeBridge }
  export function createApp(deps: AppDeps): Hono
  ```
- Endpoints:
  - `GET /api/health` → `{ ok: true, app: 'specboard' }`
  - `GET /api/projects` → `ProjectEntry & { progress: { done: number; total: number } }[]`
  - `GET /api/projects/:pid` → `{ entry, project: Project, nextId: string }`, using core's `Project` as is, with `specs` and `archived` sorted with `compareIds`
- Static files: if `webDist` is set, `GET /*` serves it, with fallback to `index.html`.

- [ ] **Step 1: Write the failing tests** (use `app.request()`, with a temp registry file and a temp copy of `examples/recipe-box`):
  - `health` returns `200 { ok: true, app: 'specboard' }`.
  - Registry: `add` of the same folder twice gives one entry. `name` is `config.name`, or the folder name if there is no config. The file is created on first write.
  - `GET /api/projects` gives one entry with `progress {done: 3, total: 9}`. As in the prototype's switcher and overview, archived specs count, and they count as done: T-100 (archived), T-101 and T-102.
  - `GET /api/projects/:pid` has 8 specs and `nextId: 'T-109'`. An unknown `pid` gives `404`.
  - **Review Focus 1:**
    - `Host: evil.com` → `403`
    - a POST with `Origin: http://evil.com` → `403`
    - a POST with `Origin: http://127.0.0.1:4949` → passes the guard
    - a GET with no Origin → passes
- [ ] **Step 2:** Run `npm test -w @specboard/server`. Expected: FAIL.
- [ ] **Step 3:** Implement. Writes to the registry file go through core's `writeIfUnchanged`, or through a temp file and rename if the file doesn't exist yet.
- [ ] **Step 4:** Run `npm test -w @specboard/server` and `npx tsc -p packages/server --noEmit`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(server): app factory, localhost guard, project registry, read endpoints`.

---

### Task 3: Spec mutation endpoints

**Files:**
- Create: `packages/server/src/routes/specs.ts`
- Modify: `packages/server/src/app.ts`
- Test: `packages/server/test/specs.test.ts`

**Interfaces:**
- Consumes: core's `writeIfUnchanged`, `setMetaField`, `setSubtaskDone`, `setAnswers`, `replaceSpecBody`, `createSpec`, `archiveSpec`, `unarchiveSpec`, `writeSiblingDraft`.
- Produces endpoints. Each `PATCH` body includes `hash: string`.
  - `PATCH /api/projects/:pid/specs/:id/meta` with `{ hash, key: 'status'|'urgency'|'categories'|'title'|'draft', value }`
  - `PATCH …/subtasks/:n` with `{ hash, done: boolean }`
  - `PATCH …/answers` with `{ hash, answers: Record<string,string> }`
  - `PATCH …/body` with `{ hash, md: string }`
  - `POST …/draft-copy` with `{ md: string }` → `{ path }` (path relative to the project)
  - `POST /api/projects/:pid/specs` with `{ title, description, draft: boolean }` → `201 { spec }`
  - `POST …/specs/:id/archive` and `POST …/specs/:id/unarchive` → `204`
- Responses:
  - success → `200 { hash, spec }`, where `spec` is the reloaded `Spec`
  - conflict → `409 { conflict: true, currentHash }`
  - core validation error → `400 { error: message }`
  - unknown spec → `404`
- The `meta` route also bumps `updated` to today in the same write, using one transform that sets both fields.

- [ ] **Step 1: Write the failing tests** (on a temp copy of the sample):
  - `meta` status `review` → `200`, the file shows `status: review`, and `updated` is today.
  - A stale hash → `409`, and the file is unchanged.
  - `value: 'wip'` → `400`.
  - `subtasks/3 {done:true}` on T-104 → progress 3/5.
  - `answers {Q1:'Yes'}` on T-105 → that question is answered.
  - `body` round-trip keeps the questions and subtasks.
  - `draft-copy` → a `spec.draft.md` file exists.
  - `POST specs` → `201` with `id 'T-109'`.
  - Archiving a spec that isn't done → `400` with message `'Only done specs can be archived'`.
  - An unknown id → `404`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement. Map `Spec.path` from `loadProject`. Look up the spec by ID among the active and archived specs.
- [ ] **Step 4:** Run `npm test -w @specboard/server`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(server): spec mutation endpoints with hash conflicts`.

---

### Task 4: References, files, overview and Claude stub endpoints

**Files:**
- Create: `packages/server/src/routes/references.ts`, `packages/server/src/safePath.ts`, `packages/server/src/routes/claude.ts`
- Modify: `packages/server/src/app.ts`
- Test: `packages/server/test/references.test.ts`

**Interfaces:**
- Produces:
  - `safeProjectPath(root: string, rel: string): string`. It throws `PathError` when the path is absolute, has a drive letter or UNC prefix, normalises outside `root`, or isn't a `.md` file.
  - `GET /api/projects/:pid/references` → `{ name, path, md, hash, missing: boolean }[]`, in config order. `name` is the basename.
  - `PUT …/references/content` with `{ path, hash, md }` → `{ hash }` or `409`
  - `POST …/references/link` with `{ path }`: the file must exist. It's added to config `references` (deduplicated).
  - `POST …/references/create` with `{ name }`: the name is uppercased and `.md` added, then written to `docs/<NAME>.md` as `# <NAME>\n\n` with the `wx` flag (`409` if it exists), and linked.
  - `DELETE …/references?path=…`: unlinks only; the file stays.
  - `POST …/references/draft-copy` with `{ path, md }` → `{ path }`
  - `GET /api/projects/:pid/files?q=` → up to 20 project-relative `.md` paths matching `q` (case-insensitive substring). It skips `node_modules`, `.git` and `.specboard`, and goes at most 6 levels deep.
  - `POST /api/claude/:action` → `501 { stub: true, action }`. Actions: `run`, `stop`, `write-up`, `fix-file`, `refresh-overview`.

- [ ] **Step 1: Write the failing tests:**
  - **Review Focus 2:** link and create with `../../secrets.md`, `C:\\Windows\\x.md`, `/etc/passwd`, `docs/../../x.md` and `\\\\server\\share\\x.md` → `400`, and config is unchanged.
  - List: the 5 sample references are present and none has `missing: true`. After unlinking `docs/STYLE-GUIDE.md`, the file still exists and there are 4 references.
  - `create {name:'deploy'}` → `docs/DEPLOY.md` exists with `# DEPLOY\n\n` and is linked. Creating it again → `409`.
  - `PUT content` with a stale hash → `409`.
  - `files?q=api` → contains `docs/API-NOTES.md` and nothing under `.specboard`.
  - `POST /api/claude/run` → `501`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test -w @specboard/server`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(server): references, file search, Claude stubs, path safety`.

---

### Task 5: File watcher + WebSocket

**Files:**
- Create: `packages/server/src/watch.ts`, `packages/server/src/hub.ts`
- Modify: `packages/server/src/app.ts` (export `attachRealtime(server, deps)`)
- Test: `packages/server/test/realtime.test.ts`

**Interfaces:**
- Produces:
  - `watchProject(entry: ProjectEntry, refs: () => Promise<string[]>, onChange: (pid: string) => void): Promise<() => Promise<void>>`. It uses chokidar on `<root>/.specboard` plus each reference file, ignores `**/*.tmp` and `**/*.draft.md`, debounces 150 ms per project, and re-reads the reference list when `config.md` changes.
  - `Hub`: a `ws` server at `/ws`, using the same Host/Origin guard on upgrade. Clients send `{ type: 'subscribe', pid }`, and the server sends `{ type: 'project-changed', pid }`. It also sends `{ type: 'hello', app: 'specboard' }` on connect.
  - `attachRealtime(httpServer, deps): Promise<{ close(): Promise<void> }>` watches every registered project, and any project added later.

- [ ] **Step 1: Write the failing tests** (a real `http` server on port 0, the `ws` client, and a temp project):
  - A subscribed client receives `project-changed` within 1 s after a write through core.
  - **Review Focus 4:**
    - 20 writes within 100 ms → at most 2 events within 1 s.
    - Creating `x.tmp` and `spec.draft.md` → no event.
  - Editing a linked reference file → an event.
  - An upgrade with `Origin: http://evil.com` is rejected.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement. Use chokidar's `awaitWriteFinish: { stabilityThreshold: 50 }`.
- [ ] **Step 4:** Run `npm test -w @specboard/server`. Expected: PASS. The tests must not leave open handles (vitest must exit on its own).
- [ ] **Step 5:** Commit: `feat(server): file watcher and websocket change events`.

---

### Task 6: CLI

**Files:**
- Create: `packages/server/src/cli.ts`, `packages/server/src/start.ts`
- Modify: root `package.json`. Add the script `"board": "npm run build -w @specboard/web && tsx packages/server/src/cli.ts"`. Until Task 7 exists, the build step is a no-op if the web package is missing.
- Test: `packages/server/test/cli.test.ts`

**Interfaces:**
- Produces:
  - `parseArgs(argv: string[]): { path: string; port: number; open: boolean }`. Defaults: path is the current directory, port `4949`, open `true`. Flags: `--port <n>` and `--no-open`.
  - `start(opts): Promise<{ url: string; close(): Promise<void> }>`:
    1. Resolve the path. If `.specboard/config.md` is missing, print `No .specboard folder in <path>. Run the Claude Code /create-spec command or "specboard init" (coming in M3).` and exit with code 1.
    2. If `GET http://127.0.0.1:<port>/api/health` returns `app: 'specboard'`, add the project to the registry and open `/?project=<id>` on the running server.
    3. Otherwise, if the port is busy, get a free port.
    4. Start the server, `attachRealtime`, then open the browser unless `--no-open`.
    5. Print `Spec Board running at <url>`.

- [ ] **Step 1: Write the failing tests:**
  - `parseArgs` defaults and flags.
  - `start` on a temp sample with `port: 0`-style free port and `open:false` → health OK.
  - A second `start` on the same port detects the running server, returns the same URL, and registers the second project.
  - A folder without `.specboard` → rejects with the message above.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement, with `open` for the browser and `get-port` for the fallback port. The registry file defaults to `~/.specboard/projects.json`, overridable with the `SPECBOARD_HOME` environment variable (tests use it).
- [ ] **Step 4:** Run `npm test -w @specboard/server`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(server): specboard CLI with running-server detection`.

---

### Task 7: Web scaffold: tokens, data layer, Storybook

**Files:**
- Create: the `packages/web/` Vite React TS app (`@specboard/web`).
  - `vite.config.ts`: dev proxy `/api` and `/ws` → `http://127.0.0.1:4949`; build output to `packages/web/dist`.
  - `index.html`: the Google Fonts link for Geist and Geist Mono.
  - `src/styles/tokens.css`: `:root`, `[data-theme=light]` and `[data-theme=dark]` copied as they are from the prototype's lines 15-26, plus the keyframes `sbPulse`, `sbSpin` and `sbIn`.
  - `src/api/client.ts`, `src/api/live.ts`, `src/state/useProject.ts`, `src/state/mutate.ts`
  - `src/lib/vm.ts`: view-model helpers, `urgVm`, `catColor`, `statusMeta`, `firstParagraph`, `truncate`, `fmtLogTime`, `relTime`
  - `.storybook/` set up with `@storybook/react-vite` and `@storybook/addon-vitest`, with a light/dark toolbar toggle that sets `data-theme`
- Modify: root `package.json` scripts: `"web:dev"`, `"storybook"`.
- Test: `packages/web/src/state/mutate.test.ts`, `packages/web/src/lib/vm.test.ts`, `packages/web/src/api/live.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // client.ts — typed fetch wrappers for every Task 2–4 endpoint; a 409 rejects with ConflictError { currentHash }, 4xx/5xx with ApiError { status, message }
  // live.ts
  export type Conn = 'live' | 'reconnecting' | 'disconnected';
  export function connectLive(pid: string, onChange: () => void, onConn: (c: Conn) => void): () => void  // backoff 0.5s,1s,2s,then 4s; 'disconnected' after the 3rd failed attempt; calls onChange on every reconnect
  // useProject.ts
  export function useProject(pid: string): { data: { entry; project; nextId } | null; conn: Conn; changed: Set<string> /* spec ids + `${id}:${n}` subtask keys changed by the last live refresh, cleared after 1.8s */; newQuestions: Set<string> /* `${id}:${qid}` first seen via live refresh */; refresh(): Promise<void> }
  // mutate.ts
  export function createMutator(send: (specId: string, baseHash: string) => Promise<{ hash: string }>): (specId: string, initialHash: string, op: (hash: string) => Promise<{ hash: string }>) => Promise<void>
  ```
  `createMutator` keeps a per-spec queue. Each queued op runs with the hash returned by the previous op, or the initial hash if it's the first. Ops for different specs run in parallel.
  - `vm.ts` values:
    - `catColor(name)` reproduces the prototype's `hue()`: `oklch(0.66 0.14 <hue>)`.
    - `urgVm(k)` gives the bars (heights 5/8/11 px, filled count urgent 3, high 3, normal 2, low 1) and colours, exactly as in the prototype's `urgVm`.
    - `fmtLogTime('2026-11-07 15:12')` → `'Nov 7, 15:12'`. It also accepts the `T` form and seconds.

- [ ] **Step 1: Write the failing tests:**
  - **Review Focus 3:** three ops on the same spec queued at once each receive the previous op's returned hash, in order.
  - Ops on two specs overlap; record start times to prove it.
  - `catColor('Frontend')` equals the prototype formula's value.
  - `urgVm('normal')` has 2 filled bars.
  - `fmtLogTime` cases.
  - `truncate('Should the export include quantities?', 40)` is unchanged; a 50-character string ends with `…` and is 40 characters long.
  - **Review Focus 5:** `connectLive` against a mock WebSocket class goes live → close → `reconnecting` → after 3 failures `disconnected` → open → `live`, and calls `onChange` on reconnect.
- [ ] **Step 2:** Run `npm test -w @specboard/web`. Expected: FAIL.
- [ ] **Step 3:** Implement, and scaffold Storybook. Add one smoke story, `Tokens/Swatches`, rendering the prototype's swatch list in both themes.
- [ ] **Step 4:** Run `npm test -w @specboard/web`, `npm run build -w @specboard/web`, and `npx vitest --project storybook --run` (or the addon's documented command). Expected: all PASS.
- [ ] **Step 5:** Commit: `feat(web): scaffold, design tokens, live data layer, storybook`.

---

### Task 8: SpecCard + Markdown components

**Files:**
- Create: `packages/web/src/components/SpecCard.tsx` (+ `.stories.tsx`, `.test.tsx`), `packages/web/src/components/Markdown.tsx` (+ stories), `packages/web/src/components/Urgency.tsx`, `CategoryTag.tsx`, `StatusChip.tsx`

**Interfaces:**
- Produces:
  - `SpecCard({ spec, all, running?: string | null, flash?: boolean, dragging?: boolean, lifted?: boolean, onOpen, onArchive, onUnarchive, onWriteUp })`
    - Port `SpecCard.dc.html` 1:1.
    - The blocked tip is built from `spec.blockedReasons`. The file-problem tip is `spec.problems[0]`.
    - The dependency line follows the prototype: up to 2 IDs, otherwise counts; an ID that isn't done is shown in `--block-ink` and bold.
    - The progress bar is hidden when there are no subtasks.
    - Drafts show the Draft tag and "Have Claude write this up".
    - Archived cards are dimmed with the "· Archived" label.
  - `Markdown({ md, size?: 'sm'|'md' })`: `react-markdown` + `remark-gfm`, styled like `Markdown.dc.html`. h1 renders at 20/600; h2 as an 11.5 px caps label in `--fg2`; h3 at 14/600; inline code and code blocks on `--code`; reading size 15/1.65 (sm: 14).

- [ ] **Step 1:** Write stories, one per prototype component-sheet card state, using the sample data from `examples/recipe-box` turned into fixtures: Default·Done (T-101), Hover, Being dragged (lifted), Blocked·questions (T-105), Running (T-104, "Persist planned meals"), In Review (T-103), Draft (T-107), File problem (a fixture with `problems`), Archived, and all four urgency levels. Do this in both themes.
- [ ] **Step 2:** Write the tests:
  - the T-105 card shows `Blocked`, and its hover tip shows `3 open questions`
  - T-108's dependency ID `T-106` uses the block colour
  - a Done card's `⋯` menu shows Archive
  - clicking the card calls `onOpen`, and so do Enter and Space while it's focused
- [ ] **Step 3:** Run `npm test -w @specboard/web` and the Storybook tests. Expected: FAIL, then implement until they PASS.
- [ ] **Step 4:** Commit: `feat(web): SpecCard and Markdown components with stories`.

---

### Task 9: App shell: top bar, filter bar, board

**Files:**
- Create: `packages/web/src/App.tsx`, `components/TopBar.tsx`, `components/ProjectSwitcher.tsx`, `components/FilterBar.tsx`, `components/Board.tsx`, `components/Column.tsx`, `components/ConnectionBanner.tsx`, `components/Toasts.tsx`, `state/toasts.ts`, `state/filters.ts` (with stories and tests for each)

**Interfaces:**
- Consumes: `useProject`, `createMutator`, `SpecCard`, the client.
- Produces:
  - `filterSpecs(specs, filters): Spec[]` and `sortSpecs(specs): Spec[]` in `state/filters.ts` (pinned behaviours 1, 4 and 5)
  - `waitItems(specs)` (pinned behaviour 3)
  - `useToasts(): { toasts; push(kind, text, sub?) }` (pinned behaviour 12)
  - the project id comes from `?project=` in the URL, or the first project; the switcher updates the URL
  - drag and drop with `@dnd-kit/core`:
    - the column under the pointer gets the dashed accent outline and `--accent-soft` background
    - a placeholder reading "Drop to move to <Column>" appears where the card will land (in sort order)
    - dropping calls the `meta` status mutation through the mutator
    - the toast follows pinned behaviour 12
  - a column header click target for Show/Hide archived; archived specs are passed to the Done column only when shown
  - the empty board state and the per-column empty text match the prototype: "Nothing to do", "Nothing in progress", "Nothing waiting on you", "Nothing done yet"
  - the floating "+ Add new spec" button (it opens the modal from Task 12; until then a no-op prop)
  - the theme toggle (pinned behaviour 20), and the connection indicator and banner (pinned behaviour 15)

- [ ] **Step 1: Write the failing tests:**
  - `sortSpecs` puts T-106 (urgent) first in To-do.
  - `filterSpecs` with category `Backend` and urgency `normal` → T-105 only. Blocked-only → T-105 and T-108.
  - `waitItems` on the sample → `['1 to review', '3 questions for you', '2 blocked']`.
  - Board render: the Done column shows `Show archived (1)` and clicking it shows T-100.
  - A drop on Review calls the mutator with `status: 'review'` (simulate the dnd-kit drop through its test utilities, or call the column's `onDrop` handler).
  - While disconnected, dragging is disabled.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement, with stories for the TopBar (Live, Reconnecting, Disconnected), the FilterBar (none, active chips), the Board (populated, empty project) and Toasts (all kinds).
- [ ] **Step 4:** Run `npm test -w @specboard/web` and the Storybook tests. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(web): app shell, filters, board with drag and drop`.

---

### Task 10: Card detail, part 1: header, spec section, blocked banner

**Files:**
- Create: `packages/web/src/components/detail/CardDetail.tsx`, `detail/DetailHeader.tsx`, `detail/StatusMenu.tsx`, `detail/UrgencyControl.tsx`, `detail/CategoryEditor.tsx`, `detail/SpecSection.tsx`, `detail/BlockedBanner.tsx`, `detail/FileProblem.tsx`, `detail/RunButton.tsx`, `components/Modal.tsx`, `components/ConflictDialog.tsx` (with stories and tests for each)

**Interfaces:**
- Produces:
  - `Modal({ label, width, onClose, children })`: scrim, Esc stack (pinned behaviour 14), focus trapping, and a click on the scrim closes it.
  - `CardDetail({ pid, specId })` opens from `?spec=<id>` in the URL. The width is `min(900px,100%)`, or `min(1240px,100%)` with a `380px` run column when the run panel is shown (Task 11). If the spec is missing from both active and archived, it shows "This spec was removed or archived" (Review Focus 4).
  - `RunButton` states: ready ("▶ Tell Claude to start"), running ("■ Stop"), disabled ("Claude is already working on <ID>"), and fallback ("Claude Code not found" plus "⧉ Copy command", which copies `claude "/run-spec <ID>"` and then shows "✓ Copied: paste it into Claude Code" for 2.6 s). In M2 the state comes from a `runState` prop that defaults to ready. Clicking calls the Claude stub.
  - `SpecSection` view: `Markdown` of `spec.bodyMd` (added to `Spec` in Task 1).
  - `SpecSection` edit: a split textarea and preview with Cancel/Save. Save calls `PATCH body`. A 409 opens `ConflictDialog` (pinned behaviour 11).
  - `BlockedBanner` (pinned behaviour 8).
  - `FileProblem`: the warning panel with `spec.problems[0]`, the file path, and "Ask Claude to fix" (stub).

- [ ] **Step 1: Write the failing tests:**
  - The status menu marks the current status "Current" and Done "Approve". Picking Done sends `status: 'done'` and shows the toast `"<ID> approved"`.
  - An urgency click sends `urgency`.
  - Adding the category `Infra` sends `categories` with it appended. A suggestion list filters existing categories and offers `Create "Payments"`.
  - Saving an edit that gets a 409 opens the conflict dialog. "Reload & keep my copy" calls `draft-copy` and shows the toast `"Your text is saved as <path>"`.
  - The T-105 banner reads `Awaiting answers on: Should the export include quantities?, How many weeks ahead should the li…, Preferred export format?` (each label cut to 40 characters).
  - The RunButton fallback copies the command.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement, with stories: card detail read mode, edit mode, blocked, file problem, and all four Run button states.
- [ ] **Step 4:** Run the tests and the Storybook tests. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(web): card detail header, spec editor, blocked banner, conflict dialog`.

---

### Task 11: Card detail, part 2: questions, dependencies, subtasks, logs, run panel

**Files:**
- Create: `packages/web/src/components/detail/Questions.tsx`, `detail/Dependencies.tsx`, `detail/Subtasks.tsx`, `detail/SubtaskLog.tsx`, `detail/RunPanel.tsx` (with stories and tests for each)

**Interfaces:**
- Produces:
  - `Questions`: pinned behaviour 9. Inputs by type: yes/no radio pair, choice radios, a number input (min 1), and a text textarea. Save sends `PATCH answers` with only the changed values; an empty string clears the answer.
  - `Dependencies`: Depends on / Needed by lists of buttons that open that spec (`?spec=`), with a status chip and "Not done" in block ink. The empty copy matches the prototype.
  - `Subtasks`: a checkbox sends `PATCH subtasks/:n` through the mutator. The `In progress` pill shows on `currentSubtask` only while a run is active (in M2 that's never, but the story covers it). There's a `≡ Log` toggle, and rows changed by a live update flash.
  - `SubtaskLog`: pinned behaviour 10, built from `spec.logs[n]`.
  - `RunPanel({ status: 'running'|'finished'|'stopped'|'needs'|'permission'|'error', lines: RunLine[], onDismiss, onAction })`: purely presentational, an exact port of the prototype's aside, including the chip colours, the line icons from the `LINE` map, and the END copy for each status (the permission state's fix snippet and "Copy rule"). M3 will feed it real lines. In M2 it is shown only in stories.

- [ ] **Step 1: Write the failing tests:**
  - Answering Q1 Yes, Q2 `2` and Q3 CSV, then saving, sends `{Q1:'Yes',Q2:'2',Q3:'CSV'}` and shows the toast "Answers saved".
  - The state labels go Needs answer → ● Unsaved → (after the refresh) ✓ Answered.
  - Save is disabled when nothing has changed.
  - **Review Focus 3:** ticking subtasks 3, 4 and 5 quickly sends three PATCHes in order, each with the previous response's hash (use a mocked client).
  - T-104 subtask 1's log shows `Nov 7` formatting, the files and the commit.
  - **Review Focus 4:** CardDetail for a spec id that disappears after a refresh shows the removed message.
  - The RunPanel `permission` story renders the fix snippet.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement, with stories: questions (unanswered, mixed, unsaved, saved), dependencies (both lists, empty), subtasks (with an open log, in progress) and RunPanel (all six statuses).
- [ ] **Step 4:** Run the tests and the Storybook tests. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(web): questions, dependencies, subtasks with logs, run panel`.

---

### Task 12: Overview, References and Add spec modals

**Files:**
- Create: `packages/web/src/components/OverviewModal.tsx`, `components/ReferencesModal.tsx`, `components/AddSpecModal.tsx`, `lib/exportOverview.ts` (with stories and tests for each)

**Interfaces:**
- Produces:
  - `OverviewModal`: pinned behaviour 17. `exportOverview(project): { filename: string; text: string }` is a pure function. The download goes through a Blob and `<a download>`.
  - `ReferencesModal`: pinned behaviour 18. Tab overflow arrows use `scrollBy(±200)`. Edit/save uses `PUT content`; a 409 opens `ConflictDialog` with keep-my-copy through `references/draft-copy`. Link suggestions come from `GET files?q=`, minus paths already linked. A missing file shows its tab with "File not found" in place of the body.
  - `AddSpecModal`: pinned behaviour 19. "Add as draft" posts `draft: true` and shows the toast `"<ID> added as draft"`. "Add & have Claude write it up" posts `draft: true` and then calls the `write-up` stub.

- [ ] **Step 1: Write the failing tests:**
  - `exportOverview` of the sample → filename `recipe-box-overview.md`, and the text starts with `# Recipe Box` and contains `- Done: 3` (2 active plus 1 archived) and the summary.
  - The ring shows `3/9`.
  - References: creating `deploy` posts `{name:'deploy'}`, then opens `DEPLOY.md` in edit mode. Removing asks for confirmation, then sends DELETE.
  - Add spec: both buttons are disabled with an empty title. The header shows `T-109`. An empty description is sent as "No description yet."
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement, with stories: overview (with summary, empty, refreshing), references (read mode, edit mode, add menu, link, create, many tabs overflowing) and add spec (empty, filled).
- [ ] **Step 4:** Run the tests and the Storybook tests. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(web): overview, references and add-spec modals`.

---

### Task 13: Wire-up and end-to-end check

**Files:**
- Modify: `packages/web/src/App.tsx` (connect every modal and the URL state), `packages/server/src/start.ts` (serve `packages/web/dist`)
- Create: `packages/server/test/e2e.test.ts` (an integration test without a browser)
- Create: `docs/superpowers/m2-manual-check.md` (the checklist below, filled in)

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Write the failing integration test.** Start the server via `start()` on a temp sample with `open: false`, connect a `ws` client, then:
  - PATCH subtask 3 of T-104 → a `project-changed` event arrives, and GET shows 3/5.
  - An external write to T-105 (through core) → an event arrives.
  - A stale-hash PATCH → `409`.
- [ ] **Step 2:** Run it. Expected: FAIL, then wire things up until it PASSES.
- [ ] **Step 3: Manual check in the built-in browser.** Run `npm run board -- examples/recipe-box --no-open`, open the printed URL in the browser pane, and check each item against the prototype. Record pass or fail and a screenshot note for each in `m2-manual-check.md`.
  - The board matches the prototype's layout and colours in both themes.
  - Dragging T-103 to Done shows the toast "T-103 approved" and changes the file.
  - Editing `examples/recipe-box/.specboard/specs/T-101…/spec.md` in an editor updates the board within a second, with a flash.
  - The T-105 answers save to the file.
  - The conflict dialog appears when the file is edited during a spec edit.
  - The overview export downloads the file.
  - Creating and removing a reference works.
  - Stopping the server shows Reconnecting… then Disconnected, and restarting it recovers.
  - **Afterwards, restore the sample** with `git checkout -- examples/recipe-box` so that test edits are never committed.
- [ ] **Step 4:** Run the full `npm test` and `tsc` for all three packages. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: wire board end to end; M2 manual check`.

---

## Done when
- `npm test` passes for core, server and web, and the Storybook tests pass.
- `npm run board -- examples/recipe-box` opens a board that matches the prototype and stays live with the files.
- Every Review Focus item has a passing test.
- `m2-manual-check.md` shows every item passing.
