# Round 7: board polish, images, answered questions, stale questions — design

Date: 2026-11-15. Repo: `claude-spec-board`. Mostly `packages/web`; small server, core and plugin-skill changes where noted.

## Intent

Kingsley tested the refactored board (round 6) and sent 12 changes. Most are polish so the board reads cleanly; two add real behaviour: specs can show images, and editing a spec flags (or refreshes) questions and subtasks that may no longer fit. Tokens matter to them: anything Claude does on its own must be cheap and minimal.

## Goals

The 12 items below, each with tests (story-based component tests via `composeStories`, as set in round 6), docs and README updated where they describe the changed behaviour, and the plugin bundle rebuilt.

## Non-goals

- Low-tokens mode (added to `docs/future-features.md` only, see item 12).
- Live chat mirroring, Add project form (still deferred).
- No visual redesign beyond the items.

## Anti-goals

- Images that let a spec read files outside the project, or serve anything that is not an image.
- A refresh that rewrites good questions/subtasks or touches finished subtasks.
- Claude runs that start on their own when background runs are not already approved for the project.
- Losing existing test coverage.

## Approaches

Mostly one sensible way per item, following what the code already does. The one real choice was item 12:

| | Approach | Trade-off |
|---|---|---|
| **A (picked)** | After a spec edit, mark it stale in its file. If background runs are already approved and Claude is installed and signed in, start a minimal refresh run automatically; otherwise show a warning with the chat command. | Uses tokens only when the person already allowed background runs; the warning survives reloads. |
| B | Always just warn, never run. | Cheapest, but more manual work. Kept for the future Low-tokens mode. |
| C | Always run after an edit. | Spends tokens on every save, and fails without approval. |

Kingsley agreed to A ("conserving tokens is important") and asked that the refresh be minimal.

## Decisions (the items)

1. **Board toggle icon:** the Board option uses `LuLayoutGrid` from `react-icons/lu` (via `lib/icons.ts`, like the other icons).
2. **App icon** in the header is a little larger (about 22px → 26px; builder picks the exact size so it still sits centred in the 52px bar).
3. **Header order (right side, regular mode):** not-connected icon (when shown), References, Overview, Simple mode switch, Logs. Simple mode and narrow screens keep their current rules for what moves into the logo menu; Logs stays last.
4. **Footer** padding a little smaller so the page has no vertical scrollbar at common desktop sizes (1280×720 and up) with the sample project. The footer stays centred.
5. **Images in Markdown** (spec body, references, anywhere `ui/markdown` renders):
   - Images render as `<img>` (max width 100%, rounded, lazy loading) instead of links.
   - `http(s)://` images load directly.
   - Relative paths resolve against the folder of the Markdown file being shown: a spec's own folder (`.specboard/specs/<ID>-<slug>/`), or the reference file's folder. Convention: a spec's images go in `<spec folder>/images/`.
   - New server route `GET /api/projects/:pid/image?path=<project-relative path>` uses `safeProjectFile` (no `..`, absolute, UNC or symlink escapes) plus an extension allowlist (`png jpg jpeg gif webp svg avif`), sends the right content type and `X-Content-Type-Options: nosniff`, and `Content-Security-Policy: sandbox` for SVG. Anything else is 404/400.
   - Other schemes (`file:`, `data:` etc.) show as the old link fallback.
   - Archived specs resolve against their archive folder.
   - Docs (`docs/guide`, `specboard` skill, `create-spec` and `update-spec` skills) say: put a spec's images in its `images/` subfolder and link them with a relative path, e.g. `![Login screen](images/login.png)`.
6. **Card description Markdown:** the card's first-paragraph text renders inline Markdown (bold, italic, inline code, strikethrough; links show as plain text because the card itself is clickable; images are dropped). Still clamped to two lines.
7. **Hover popups:** info popovers on icon-only markers (obsolete warning, not-connected icon, waiting markers, and the new stale warning) open on hover and keyboard focus on pointer devices, and on tap on touch. They close when the pointer leaves (with a short grace so the docs link inside can be clicked).
8. **Logs window "More info":** each subtask's newest log row gets a collapsed "More info" toggle. Opened, it shows the same details as the subtask log in a card: files changed (clickable `FileLink`), commit, PR link, tokens. Tokens move from the row into More info. `state/allLogs.ts` carries `files`, `pr`, `commit` on that row.
9. **Questions:**
   - A question with a saved answer shows the answer as plain text plus an **Edit** button; Edit shows the normal input (text box or options) again, with Cancel.
   - Unanswered questions (needed or "can skip") show the input as today.
   - When the spec is in **Review** or **Done**, answers are read-only: no Edit button, no inputs, no Save. Unanswered questions there show "No answer".
10. **Clickable path in save toasts:** toasts can carry a file path shown as a `FileLink` (VS Code, else copy). Used by "Spec saved" and "Answers saved".
11. **Spec editor buttons:** Cancel and Save move to the bottom of the spec section, right-aligned under the editor and preview.
12. **Stale questions and subtasks after a spec edit:**
    - When the spec text is saved from the board (spec in To-do or Doing, not a draft; see "Calls made after the builder check"), the server writes `needs_refresh: YYYY-MM-DD` to the spec's front matter (core parses it as `needsRefresh: string | null`).
    - **Auto refresh:** if the project's background runs are approved and Claude is installed and signed in, the board starts a background run of kind `refresh-questions` right after the save. The card shows the usual running state. If a run is already going, or the run fails, the flag stays and the warning shows.
    - **Warning otherwise:** a warning icon at the right end of the Open questions and Subtasks headings, with a hover popover: "These may be out of date after the last spec edit. Run `/specboard:refresh-questions <ID>` in Claude." with a copy button for the command.
    - **New skill `plugin/skills/refresh-questions/SKILL.md`** (`/specboard:refresh-questions <ID>`), minimal by design: read the spec; remove open questions and unstarted subtasks that no longer make sense; add only questions/subtasks the new text needs; never reword ones that still fit; never touch ticked subtasks, their logs, or answered questions that still apply; then remove `needs_refresh`. Background prompt: `/specboard:refresh-questions <ID> --board`.
    - `specboard` skill's format section documents `needs_refresh` (set by the board, cleared by refresh-questions).
    - `docs/future-features.md` gains **Low-tokens mode**: a setting where Claude does as little as possible on its own (no automatic runs such as this refresh; prefer manual steps and the cheapest prompts).

## Calls made after the builder check

- **Who starts the refresh:** the web client, right after a successful save. The save response returns the spec with `needsRefresh`. The client already knows whether runs are approved and whether Claude is installed and signed in (the `/run` status that `runUi` and the not-connected icon use), so no new check is needed. If the tab closes first, the flag stays and the warning shows next time.
- **When a spec is flagged:** only for specs in **To-do** or **Doing** that are not drafts. The spec doesn't need any questions or subtasks yet, because the refresh may add some. Review and Done specs are treated as frozen: they are never flagged and never auto-refreshed.
- **Failed and forgotten clears:** if a refresh run finishes but the flag is still in the file, the flag stays and the warning shows. A save conflict (the existing hash check) writes nothing, so it sets no flag and shows no toast.
- **Front matter:** adding or removing `needs_refresh` changes only that one line and keeps every other key and its order as it was. A core test proves this.
- **Image paths:** `Markdown` gets an optional `baseDir` (a project-relative folder), and the client joins it with relative image links. Where `baseDir` is missing (logs, card text), a relative image falls back to a link. The route must accept `.specboard/...` paths. If `safeProjectFile` rejects dotfolders, the builder allows them for this route only.
- **Popover:** this is a hybrid. Radix Popover opens on hover and focus for a fine pointer and on tap for touch, with about 150ms grace on leave. HoverCard alone is not enough, because it doesn't work on touch.
- **Footer check:** this is a manual screenshot of the recipe-box sample at 1280×720 using `packages/web/scripts/screens.mjs`. It can't be checked in a unit test.

### The skills question (answered in chat)

The skills live in `plugin/skills/<name>/SKILL.md` (14 today, 15 after this round). The README already says so.

## Left to the builder

- Exact sizes, spacing and icon for the stale warning (reuse `WarnIcon`).
- How the inline-Markdown card renderer is built (react-markdown with limited elements or a small renderer).
- Hover-open mechanics for the popover (Radix Popover driven by hover, or HoverCard) as long as touch still opens on tap.
