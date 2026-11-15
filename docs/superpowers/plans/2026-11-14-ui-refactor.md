# UI Refactor (Tailwind, shadcn, component folders) + Round 3 Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move `packages/web` to Tailwind + a few shadcn primitives, put every component in its own folder with a story and a story-based test, and land the round 3 fixes on the way.

**Architecture:** Set up the foundation first (Tailwind v4 tokens, shadcn primitives, `@/` alias, `composeStories` test setup). Then migrate one area per task, folding that area's fixes in. Each task leaves the app building and every test green.

**Tech Stack:** React 19, Vite 7, Tailwind v4 (`@tailwindcss/vite`), shadcn/ui (Radix, vaul), Storybook 9, Vitest 3 + happy-dom + React Testing Library, react-icons (Lucide set `react-icons/lu`).

**Spec:** `docs/superpowers/specs/2026-11-14-ui-refactor-design.md`. Read its "Decisions" and "Calls made after the builder check" sections; they bind every task.

## Global Constraints

- Only `packages/web` changes, except two places: `examples/recipe-box/.specboard/archive/T-100-project-scaffold/spec.md` (Task 6), and docs, README and the `plugin/web` bundle (Task 11).
- Token palette unchanged: `styles/tokens.css` values stay byte-identical; Tailwind reads them through `@theme inline`. Dark mode = `[data-theme=dark]` custom variant.
- shadcn is used for exactly these: dropdown-menu, dialog, drawer, popover, tooltip, switch, toggle-group (+ the `button` it needs internally if any). Nothing else from shadcn.
- Layout: `src/components/<kebab-name>/<kebab-name>.tsx` + `.stories.tsx` + `.test.tsx` (+ helpers it alone uses). Reusable pieces under `src/components/ui/<kebab-name>/`. No barrel/index files. `lib/`, `state/`, `api/` keep their shape.
- Component tests render stories: `import * as stories from './x.stories'; const { Default } = composeStories(stories);`. Logic tests in `lib/` and `state/` stay plain.
- No CSS modules at the end; no static `style={{…}}` (runtime-computed values such as dnd transforms or progress widths are fine). Global CSS allowed only for: `styles/tokens.css`, the Tailwind entry, and third-party overrides (driver.js tour).
- `useNarrow` stays `max-width: 720px`.
- Exact copy: not-connected popover title **"Claude isn't connected to the board"**. The words "non-agentic", "Manual mode" and "Manual" (as a mode name) leave the UI.
- Theme storage key `specboard.theme`, values `light|dark|system`, default `system`.
- Log times: relative ("just now", "5 minutes ago", "3 days ago" via `Intl.RelativeTimeFormat('en', { numeric: 'auto' })`) when under 30 days old; otherwise `YYYY-MM-DD HH:mm` local; exact timestamp in a tooltip.
- Dependencies pinned to exact versions (no `^`), matching the repo's style.
- Commits: plain messages, **never** a `Co-Authored-By` or any Claude attribution line.
- Do not touch `git stash@{0}`.

## Review Focus

1. **Layers inside the card detail dialog:** dropdowns, popovers and tooltips opened inside a Dialog must render above it and stay clickable. Escape closes only the top-most layer, and the discard guard still fires when the dialog itself closes. *Test owned by Task 8.*
2. **Dragging cards still works:** wrapping card icons in Tooltip/Popover must not swallow dnd-kit pointer events, and opening a card by click must still work. *Test owned by Task 6.*
3. **Theme "System":** follows an OS change while the page is open, and still works when localStorage throws. *Test owned by Task 4.*
4. **Time-ago boundaries:** exactly 30 days → absolute date; a future timestamp (clock skew) → "just now"; an unparseable time → shown raw. *Test owned by Task 9.*
5. **Narrow boundary:** at 720px the filters, menus and the milestone picker open as drawers; at 721px they open as dropdowns. Neither runs off-screen at 375px. *Test owned by Task 5.*

## Component → folder map

| Today | New folder |
|---|---|
| StatusChip, CategoryTag, Urgency, Skeleton, Markdown, Modal, Dialog.tsx (confirm), Toasts | `ui/status-chip`, `ui/category-tag`, `ui/urgency`, `ui/skeleton`, `ui/markdown`, `ui/modal`, `ui/confirm-dialog`, `ui/toasts` |
| new | `ui/responsive-menu`, `ui/hint` (tooltip wrapper for icon-only buttons), `ui/info-popover` |
| TopBar, ProjectSwitcher, ManualNotice, ConnectionBanner, Footer | `top-bar`, `project-switcher`, `not-connected`, `connection-banner`, `footer` |
| FilterBar | `filter-bar` (+ `filter-bar/milestone-picker.tsx`, `filter-bar/filters-drawer.tsx`) |
| Board, Column, SpecCard | `board`, `column`, `spec-card` |
| TableView | `table-view` |
| detail/* | `card-detail/` with one subfolder per part: `card-detail/subtasks`, `card-detail/subtask-log`, `card-detail/questions`, `card-detail/dependencies`, `card-detail/run-button`, `card-detail/run-panel`, `card-detail/detail-header`, `card-detail/status-menu`, `card-detail/urgency-control`, `card-detail/category-editor`, `card-detail/blocked-banner`, `card-detail/file-problem`, `card-detail/spec-section` |
| Overview/References/Settings/Logs/Sync/AddSpec/Conflict modals, DocsPage | `overview-modal`, `references-modal`, `settings-modal`, `logs-modal`, `sync-dialog`, `add-spec-modal`, `conflict-dialog`, `docs-page` |
| useDiscardGuard.tsx | `lib/use-discard-guard.tsx` |
| state/fileLinks.tsx (+css) | stays in `state/`, CSS moved to Tailwind |

## Tailwind migration checklist (tick as each lands)

- [x] ui/status-chip · [x] ui/category-tag · [x] ui/urgency · [x] ui/skeleton · [x] ui/markdown · [x] ui/modal · [x] ui/confirm-dialog · [x] ui/toasts
- [x] top-bar · [x] project-switcher · [x] not-connected · [x] connection-banner · [x] footer
- [x] filter-bar · [x] board · [x] column · [x] spec-card · [x] table-view
- [x] card-detail (all parts) · [x] state/fileLinks
- [x] overview-modal · [x] references-modal · [x] settings-modal · [x] logs-modal · [x] sync-dialog · [x] add-spec-modal · [x] conflict-dialog · [x] docs-page
- [x] `modals.module.css`, `settings.module.css`, `logs.module.css`, `detail/*.module.css` deleted
- [x] `find src -name '*.module.css'` prints nothing
- [x] `base.css` preflight bridge removed (Task 10); global CSS is only `tokens.css`, `app.css` and `lib/tour.css`

---

### Task 1: Baseline screenshots

**Files:** Create `packages/web/scripts/screens.mjs` (committed; reused in Task 11).

**Produces:** `node packages/web/scripts/screens.mjs <outDir>`. It starts the board server on the sample (`examples/recipe-box`) on a free port with the built web app, then uses Playwright Chromium to save PNGs. Each screen is captured at 1280×800 and 375×812, in both themes (set `localStorage['specboard.theme']` before load). Screens:
- board
- table
- card detail T-104
- overview
- logs modal
- logo menu open

Files are named `<screen>-<width>-<theme>.png`.

- [x] Step 1: Write the script, using the existing server CLI (`packages/server` start command with `--port`) and `npm run build -w @specboard/web` first.
- [x] Step 2: Run it into `<sdd workspace>/screens/before`. Expected: 24 PNGs; open two to check they show the sample board.
- [x] Step 3: Commit `web: screenshot script for visual checks`.

### Task 2: Foundation — Tailwind, shadcn primitives, alias, story-based tests

**Files:**
- Modify `packages/web/package.json`, `vite.config.ts`, `vitest.unit.config.ts`, `vitest.storybook.config.ts`, `tsconfig.json`, `.storybook/preview.tsx`, `src/main.tsx`, `src/test/setup.ts`, `src/styles/base.css`.
- Create:
  - `components.json`
  - `src/styles/app.css`, the Tailwind entry
  - `src/lib/utils.ts`, with `cn`
  - `src/components/ui/{dropdown-menu,dialog,drawer,popover,tooltip,switch,toggle-group}/<name>.tsx`, each with `.stories.tsx` and `.test.tsx`

**Produces:**
- `@/` path alias to `src/`, working in Vite, Vitest (both configs), Storybook and tsc.
- `cn(...inputs: ClassValue[]): string`.
- Tailwind colour utilities named after the tokens: `bg|text|border-{bg,panel,card,raise,line,line2,fg,fg2,fg3,accent,accent-hover,accent-fg,accent-soft,accent-ink,doing,doing-soft,doing-ink,review,review-soft,review-ink,done,done-soft,done-ink,block,block-soft,block-ink,scrim,code}`.
- `font-sans` and `font-mono` from `--sans` / `--mono`; `shadow-lg` from `--shadow-lg`.
- Animations `animate-sb-pulse`, `animate-sb-spin` and `animate-sb-in`.
- `dark:` variant = `&:where([data-theme=dark], [data-theme=dark] *)`.
- The shadcn components above, styled with these tokens instead of shadcn's default palette. Their exports are the standard shadcn names (e.g. `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuSub`, `DropdownMenuSubTrigger`, `DropdownMenuSubContent`, `DropdownMenuRadioGroup`, `DropdownMenuRadioItem`, `DropdownMenuSeparator`, `DropdownMenuLabel`; `Dialog*`; `Drawer*`; `Popover*`; `Tooltip*` + `TooltipProvider`; `Switch`; `ToggleGroup`, `ToggleGroupItem`).
- `TooltipProvider` wraps the app in `main.tsx` and the Storybook preview.
- `src/test/setup.ts` calls `setProjectAnnotations([previewAnnotations])` from `@storybook/react-vite`. It also stubs what Radix/vaul need in happy-dom: `ResizeObserver`, `matchMedia` if missing, `scrollIntoView`, and pointer capture methods.
- Add `@testing-library/user-event` (exact version) for menu interaction tests.

- [x] Step 1: Install exact-pinned deps:
  - `tailwindcss`, `@tailwindcss/vite`
  - `clsx`, `tailwind-merge`, `class-variance-authority`
  - `@radix-ui/react-dropdown-menu`, `@radix-ui/react-dialog`, `@radix-ui/react-popover`, `@radix-ui/react-tooltip`, `@radix-ui/react-switch`, `@radix-ui/react-toggle-group`
  - `vaul`, `@testing-library/user-event`

  Generate the primitives with the shadcn CLI or copy them from the shadcn source. Move each into its own folder.
- [x] Step 2: Write failing tests for each primitive's story:
  - dropdown-menu: opens on Enter, shows items, and a submenu item opens its submenu.
  - dialog: opens, then Escape closes it.
  - drawer: opens and shows content.
  - popover: opens on click and closes on Escape.
  - tooltip: shows its label on focus.
  - switch: toggles `aria-checked`.
  - toggle-group: selecting an item sets `data-state="on"`.

  Run `npm test -w @specboard/web`. Expected: FAIL (modules missing).
- [x] Step 3: Implement the setup. `app.css` imports Tailwind with preflight, then `tokens.css`, then `@theme inline` mappings. Keep `base.css` rules that preflight doesn't cover, moved into `@layer base`. `main.tsx` imports `app.css`, and the existing CSS modules keep working beside it.
- [x] Step 4: Run `npm test -w @specboard/web`, `npm run test:stories -w @specboard/web` and `npx tsc -p packages/web`. Expected: all green, and the existing test count unchanged plus the new tests.
- [x] Step 5: Run `screens.mjs` into `screens/after-task2` and compare by eye with `before`. Preflight must cause no visible drift; fix any in `@layer base`.
- [x] Step 6: Commit `web: tailwind, shadcn primitives and story-based test setup`.

### Task 3: Shared UI pieces

**Files:**
- Move and convert to Tailwind: StatusChip, CategoryTag, Urgency, Skeleton, Markdown, Modal, Dialog.tsx (→ `ui/confirm-dialog`), Toasts, into `components/ui/*` as mapped. Delete their `.module.css`.
- Create `ui/responsive-menu`, `ui/hint` and `ui/info-popover`.
- Update every import site.

**Produces:**
- `Modal`, with the same props as today. It is rebuilt on `ui/dialog`, keeping:
  - the title;
  - the close button;
  - the `wide` variant (if present);
  - the focus return;
  - the existing `useDiscardGuard` hook, which still decides whether a close may proceed.
- `ConfirmDialog`: same API as today's `Dialog.tsx`.
- `Hint({ label, children, side? }: { label: string; children: ReactElement; side?: 'top'|'bottom'|'left'|'right' })`: a Tooltip around an icon-only trigger, which also sets `aria-label` on it when missing.
- `InfoPopover({ trigger, title?, children, label })`: a click/tap Popover for indicators that carry information. `label` is the trigger's accessible name.
- `ResponsiveMenu({ trigger, title, children, align? })`: on wide screens a DropdownMenu, on narrow screens (`useNarrow()`) a bottom Drawer titled `title`.
  - Children use `ResponsiveMenuItem({ onSelect, children, checked?, disabled? })`, `ResponsiveMenuSeparator`, `ResponsiveMenuLabel` and `ResponsiveMenuSub({ label, children })`.
  - In the drawer, Sub renders as a labelled group instead of a flyout.
  - Selecting an item closes the menu or drawer.

- [x] Step 1: Move each component's existing tests into story-based tests in its folder, keeping every assertion. Add tests:
  - Hint: the label is shown on focus, and `aria-label` is set.
  - InfoPopover: a click opens it, the title is shown, Escape closes it.
  - ResponsiveMenu wide: a dropdown opens, an item calls `onSelect` and the menu closes.
  - ResponsiveMenu narrow (story with `useNarrow` mocked through a `matchMedia` decorator): a drawer opens with the title, and a Sub shows as a group.
  - Modal: Escape closes it; with a dirty discard guard, Escape asks first.
  
  Run them. Expected: FAIL.
- [x] Step 2: Implement, then run web tests, stories and tsc. Expected: green.
- [x] Step 3: Tick the checklist lines and commit `web: shared ui pieces in tailwind`.

### Task 4: Header — top bar, project switcher, not-connected icon, logo, theme

**Files:**
- Move and convert TopBar, ProjectSwitcher, ManualNotice (→ `not-connected`), ConnectionBanner and Footer.
- Modify `lib/theme.ts` and `App.tsx`; move `TopBar.menu.test.tsx`, `Shell.test.tsx` and `SimpleMode.test.tsx` into story-based tests in `top-bar/`.
- Move `spec-board-logo.svg` and `spec-board-non-agentic.svg` from the repo root to `packages/web/src/assets/` (`git mv`), renaming the second to `not-connected.svg`. Copy the logo to `packages/web/public/favicon.svg` and link it in `index.html`.

**Produces:**
- `type ThemeChoice = 'light'|'dark'|'system'`.
- `savedThemeChoice(): ThemeChoice`. It returns `system` when nothing is saved, the value is invalid, or storage throws.
- `resolveTheme(choice: ThemeChoice): 'light'|'dark'`.
- `applyThemeChoice(choice: ThemeChoice, remember?: boolean): void`.
- `watchSystemTheme(onChange: () => void): () => void`, which listens to `prefers-color-scheme` changes.

  App keeps the choice in state. While it is `system`, a matchMedia change re-applies the theme.

Header layout, left to right:
- logo (new SVG) + "Spec Board" menu trigger;
- project switcher (green connection dot + name, as today);
- spacer;
- Simple mode `Switch` labelled "Simple mode" (hidden on narrow screens, where it lives in the logo menu);
- not-connected icon (when shown);
- References (book icon `LuBookOpen`) and Overview (`LuChartPie`): text + icon in regular mode; in the logo menu in Simple mode or on narrow screens;
- Logs (`LuScrollText`) always last in the header: icon + text in regular and Simple mode, icon-only with a `Hint` on narrow screens. Logs is never in the logo menu.

Logo menu (a `ResponsiveMenu`), in order:
1. Documentation, Take the tour, Sync with code (+ waiting item), Settings;
2. a separator;
3. References and Overview (Simple mode or narrow only);
4. Simple mode toggle (narrow only);
5. a Theme sub with radio items Light / Dark / System.

**Not-connected:** an icon button showing `assets/not-connected.svg` at 22px with `rounded-md`. Its accessible name is "Claude isn't connected to the board". It opens an `InfoPopover` with that title and the existing explanation text and docs link, reworded so it never says "non-agentic", "manual mode" or "Manual". It is shown under the same condition as today's ManualNotice.

**Footer:** content centred; the Add spec button is unaffected.

- [x] Step 1: Rewrite the moved tests as story-based tests and update them for the new layout. Add these tests:
  - No "Manual" or "non-agentic" text anywhere in the header.
  - The not-connected button opens a popover with the exact title.
  - In Simple mode, Logs is still in the header and is the last button, while References and Overview are in the menu.
  - On narrow screens, Logs is icon-only with an accessible name of "Logs".
  - The Theme sub has three radio items, and picking Dark sets `data-theme="dark"` and saves `dark`.
  - Theme logic:
    - `savedThemeChoice()` returns `system` when storage throws;
    - with `system`, a simulated matchMedia change flips `data-theme`;
    - the old saved values `light`/`dark` still load.
  - The Simple mode switch is in the top bar and toggles Simple mode.
  - The footer is centred (its container has the centring class) and the GitHub link is present.

  Run them. Expected: FAIL.
- [x] Step 2: Implement. Update `lib/tour.ts` steps whose targets moved (the Simple mode step now targets the header switch).
- [x] Step 3: Run web tests, stories and tsc. Expected: green. Tick the checklist and commit `web: header in tailwind (logo, not-connected icon, theme submenu, logs placement)`.

### Task 5: Filter bar — icon toggle, milestone picker, mobile filters drawer

**Files:** Move and convert FilterBar to `filter-bar/`. Create `filter-bar/milestone-picker.tsx` and `filter-bar/filters-drawer.tsx`, each with a story and a test. Remove Simple mode from the filter bar.

**Produces:**
- **View switch:** Board | Table becomes a `ToggleGroup` with icon-only items (`LuKanban` for Board, `LuTable2` for Table). Each item has a `Hint` label ("Board view" / "Table view") and an accessible name.
- **Milestone picker:** a `ResponsiveMenu` whose trigger is plain text, not a boxed input. It shows the milestone name in bold, then ` · done/total` in fg2, then a chevron. The items are the existing milestone options with their counts, plus "All milestones".
- **Wide screens:** the Category and Urgency dropdowns become `ResponsiveMenu`s with checkbox items, and the Blocked only toggle becomes a `Switch`.
- **Narrow screens:** Category, Urgency and Blocked only are replaced by one "Filters" button that opens a bottom drawer containing all three. The button shows a badge with the number of active filters, and the drawer has a "Clear filters" action. The view switch and milestone picker stay visible.

- [x] Step 1: Write story-based tests, keeping every existing FilterBar assertion:
  - Board/Table items have names "Board view" and "Table view" and switch the view.
  - The milestone trigger shows `Basics · 2/3` in bold text and is not an `input` or `select`.
  - At narrow width (720), there is a "Filters" button with badge `1` when one category is chosen. It opens a drawer containing the Category, Urgency and Blocked only controls.
  - At 721, the controls are inline and Category opens as a menu, not a drawer.
  
  Run them. Expected: FAIL.
- [x] Step 2: Implement. Then run web tests, stories and tsc. Expected: green. Tick the checklist and commit `web: filter bar in tailwind (icon view switch, milestone picker, mobile filters drawer)`.

### Task 6: Board, columns, cards, archive fix, bottom spacing

**Files:**
- Move and convert Board, Column and SpecCard to their folders.
- Modify `state/filters.ts`, which gains `archivedShown`.
- Modify `examples/recipe-box/.specboard/archive/T-100-project-scaffold/spec.md`: add `milestone: Basics` after `categories`.
- Modify `src/fixtures/recipeBox.ts` to mirror it. Update any core or server test that asserts T-100 has no milestone, and only those.

**Produces:**
- `archivedShown(archived: Spec[], f: Filters, milestones: string[]): Spec[]`. It returns `filterSpecs` with `blockedOnly` treated as false.
- The Done column's toggle reads "Show archived (N)" / "Hide archived (N)", where N = `archivedShown(...).length`. The toggle is hidden when N is 0.
- The empty band below the columns (above the horizontal scrollbar) shrinks: the board's bottom padding goes to 8px (`pb-2`) and the columns stretch to fill the height.
- Icon-only indicators on cards (blocked, waiting, questions) get a `Hint`, or an `InfoPopover` when they carry a reason.

- [x] Step 1: Write the tests:
  - `archivedShown`: with milestone Basics, T-100 (now Basics) is included; with milestone Planning it isn't; Blocked only doesn't hide archived specs.
  - Board story with the sample + milestone Planning: no archived toggle.
  - Board story with milestone Basics: "Show archived (1)", and clicking it shows "Project scaffold".
  - Review Focus 2: a drag via dnd-kit's keyboard sensor (Space, ArrowRight, Space) on a card with an icon Hint still moves it (`onMove` called). Clicking the card still opens it.
  
  Keep all existing Board, SpecCard and Column assertions as story-based tests. Run them. Expected: FAIL.
- [x] Step 2: Implement. Then run web, core and server tests, stories and tsc. Expected: green. Tick the checklist and commit `web: board in tailwind, archived count follows filters, tighter bottom spacing`.

### Task 7: Table view with aligned columns

**Files:** Move and convert TableView to `table-view/`.

**Produces:**
- Every group table (milestone groups, "No milestone", Archived) uses `table-fixed` and one shared `<colgroup>` from a single constant `TABLE_COLUMNS`. Widths:
  - chevron 40px; ID 96px;
  - Title auto; Status 140px; Progress 96px; Urgency 112px;
  - Categories 220px; Tokens 96px, omitted when tracking is off.
- Long titles truncate with an ellipsis and a `Hint` showing the full title.
- The compact (narrow) variant keeps its own column set, shared across its groups in the same way.

- [x] Step 1: Write story-based tests:
  - Every `table` in the Milestones story has a `colgroup` with the same `col` widths in the same order.
  - With tracking off, there is no Tokens `col` and no Tokens header.
  - The existing TableView assertions still pass.
  
  Run them. Expected: FAIL.
- [x] Step 2: Implement. Then run tests, stories and tsc. Expected: green. Tick the checklist and commit `web: table view in tailwind with aligned columns`.

### Task 8: Card detail

**Files:**
- Move every `components/detail/*` part into `card-detail/` subfolders, as mapped, and convert them to Tailwind.
- Delete `detail.module.css` and `sections.module.css`.
- Move `state/fileLinks.module.css` to Tailwind.
- Split `parts.stories.tsx` and `parts.test.tsx` into the parts' own folders.

**Produces:**
- The same behaviour as today.
- StatusMenu and the category/urgency pickers use `ResponsiveMenu`.
- In SubtaskLog:
  - The obsolete warning icon becomes an `InfoPopover` with the title "Obsolete" and the body "Since <date>: <reason>", or the reason alone when there is no date.
  - The PR link, tokens and done time stay as they are.
- Every icon-only control in the detail (close, copy, run controls, file links) gets a `Hint`.

- [x] Step 1: Write the tests:
  - Move all existing detail tests into story-based tests in their folders.
  - Obsolete: clicking the icon opens a popover with "Obsolete" and "Since 2026-11-10:" (use the fixture's obsolete log).
  - Review Focus 1, in a CardDetail story:
    - Open the status menu inside the dialog and pick "Review"; `onStatus` is called and the dialog stays open.
    - Open the obsolete popover, press Escape: the popover closes and the dialog stays open. Press Escape again: the dialog closes.
    - With a dirty edit, Escape asks before closing.
  
  Run them. Expected: FAIL.
- [x] Step 2: Implement. Then run tests, stories and tsc. Expected: green. Tick the checklist and commit `web: card detail in tailwind with popovers`.

### Task 9: Modals, logs grid, docs page

**Files:** Move and convert the Overview, References, Settings, Logs, Sync, AddSpec and Conflict modals and DocsPage to their folders. Delete `modals.module.css`, `settings.module.css`, `logs.module.css`, `DocsPage.module.css` and `Markdown.module.css` if any remain. Modify `state/allLogs.ts`.

**Produces:**
- `formatLogTime(at: string, now: Date): { label: string; exact: string }`, in `lib/formatLogTime.ts`, following the Global Constraints rule:
  - `exact` = `YYYY-MM-DD HH:mm`;
  - a future time → "just now";
  - an unparseable time → label = exact = the raw string.
- The Logs modal is a two-column grid (`grid-cols-[auto_1fr]`, gap 12/16px):
  - Left column: the time label, in mono and fg3, with a `Hint` showing `exact`.
  - Right column: `T-104 · Meal planner calendar`, then the subtask title, then the text, and the token count and obsolete icon (InfoPopover) when present.
  - Day group headings are removed; `groupByDay` is deleted along with its tests.
  - Search, entry click (opens the spec) and "Open overview" are unchanged.
- The Settings switch uses `Switch` and is disabled while saving (fixes the deferred double-click race).

- [x] Step 1: Write the tests:
  - `formatLogTime` at a fixed `now` = 2026-11-14 12:00 local:
    - 2026-11-14 11:59 → "1 minute ago";
    - 2026-11-13 12:00 → "yesterday";
    - 2026-10-16 12:00 (29 days) → "29 days ago";
    - 2026-10-15 12:00 (30 days) → "2026-10-15 12:00";
    - 2026-11-15 09:00 → "just now";
    - "garbage" → "garbage".
  - Logs modal story: each entry is a row of two cells; there are no "Today"/"Yesterday" headings; the time cell has a Hint showing the exact time.
  - The Settings switch is disabled while `setSettings` is pending.
  - All existing modal tests are moved as story-based tests.
  
  Run them. Expected: FAIL.
- [x] Step 2: Implement. Then run tests, stories and tsc. Expected: green. Tick the checklist and commit `web: modals in tailwind, logs as a time grid`.

### Task 10: App tests, leftovers, cleanup

**Files:** `App*.test.tsx`, `lib/tour.css` (keep as global third-party CSS), and any file still importing a `.module.css` or with static inline styles. Also `src/stories/Swatches.stories.tsx`, which should show the Tailwind token classes.

- [x] Step 1: Run `find packages/web/src -name '*.module.css'`, which must print nothing. Then grep `style={{` and convert any remaining static ones; runtime-computed values may stay.
- [x] Step 2: App-level tests stay as integration tests, fixed for the new structure. Move them to `src/app/` only if that's cleaner; otherwise leave them next to `App.tsx`.
- [x] Step 3: Check every component folder has a `.stories.tsx` and a `.test.tsx`. Add any that are missing, with at least a render-and-assert-key-content test.
- [x] Step 4: Run all suites (core, server, web, stories) and tsc. Expected: green. Commit `web: remove css modules and inline styles`.

### Task 11: Docs, README, visual check, plugin bundle

**Files:**
- README: a "Frontend layout" section in the contributor part, the "Where the skills live" line (`plugin/skills/`), and screenshots if they reference removed UI.
- `docs/guide/*` and `packages/web/src/lib/docsPages.ts` (if it holds doc text): not-connected wording, the Simple mode location, the Theme submenu, the logs layout and the filters drawer.
- `docs/documentation.md`.
- `plugin/web` (rebuilt).

- [x] Step 1: Grep the repo (excluding `docs/superpowers` and `node_modules`) for "non-agentic", "Manual mode" and "Dark mode". Update the user-facing ones.
- [x] Step 2: Run `screens.mjs` into `screens/after` and compare each pair with `before`. Only the listed fixes may differ; fix any other drift.
- [x] Step 3: `npm run build:plugin`. Run all suites and tsc. Expected: green, and the bundle staleness test passes.
- [x] Step 4: Commit `docs: frontend layout, not-connected wording, theme and logs` and `plugin: rebuild bundle`.
