# Milestone 2: deferred follow-ups

These items came up in the M2 reviews and were deliberately left out of M2. Read this list when planning M3.

## Do soon
- **Re-bump `@hono/node-server` to 1.19.18 or later** after 2026-11-16. One moderate advisory remains in `serveStatic`, which the server does not use. 1.19.18 is still too new under the two-week rule.
- **CI must build the web app before `npm test`.** Otherwise the e2e `GET /` test is skipped without notice.

## M3 design input (from the final review)
- **Typed WebSocket messages:** generalise `Hub.broadcast(pid)` into `send(pid, msg)` with kinds such as `project-changed`, `run-started`, `run-line`, `run-ended` and `permission`.
- **One `useRun(pid)` hook:** feed RunPanel (`{status, lines}`) and RunButton (`runState`) from it. Today they are props with no data source.
- **Project-scoped Claude routes:** `POST /api/projects/:pid/specs/:id/run` and `/stop`, with validated bodies. Give `ClaudeBridge` real methods: `run`, `stop`, `state`.
- **Apply writes locally:** apply the returned `spec` to the local snapshot after each write, to close the short stale-hash window once Claude writes often. Also call `onChange` on the first WebSocket open.
- **Watcher and sockets:** log watcher errors, and add a ping/pong liveness check.
- **Malformed front matter:** editing such a spec returns 500. Map it to 422 so the UI can say "fix the file first", or "Ask Claude to fix".
- **Packaging:** ship a prebuilt `dist`, because `npm run board` currently runs a full build on every launch.

## Smaller items
- **Server and CLI:**
  - The registry name is frozen at add time.
  - A deleted project folder still shows as `0/0`.
  - The "already running" check ignores `SPECBOARD_HOME`.
  - Signal handlers are installed only after startup.
- **References:**
  - Link de-duplication and DELETE are case-sensitive on Windows.
  - A config entry that points outside the root can't be unlinked.
  - A dangling symlink at a draft path can escape the project.
  - `Remove` has no double-click guard.
  - Tab arrows aren't rechecked when the modal is resized.
- **Questions:**
  - Saving clears every New badge, including on unanswered questions.
  - Number answers are not validated (`0`, `-5`).
  - Questions of new specs that are already answered still show New.
- **Board:**
  - A pointer drag can start from the inner buttons.
  - A failed refresh after a move briefly shows the old column.
  - Category suggestions and the status menu have no arrow-key navigation.
- **Markdown:**
  - Unsafe URLs leave anchors with an empty `href`.
  - `####` headings are not shifted.
  - Linked images produce nested `<a>` elements.
- **Accessibility:**
  - The card's aria-label hides its blocked and review state.
  - Tooltips work with the mouse only.
- **Tests:**
  - The e2e test counts events absolutely instead of against a baseline.
  - Several races are untested: revert, draft survival, forced conflicts.
  - Tests for the static, OPTIONS and HEAD guards are missing.
