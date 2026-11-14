# UI refactor (Tailwind, shadcn, component folders) + round 3 fixes — design

Date: 2026-11-14. Repo: `claude-spec-board`, package `packages/web` only (core, server and plugin skills are untouched except where noted).

## Intent

Spec Board is Kingsley's portfolio project. The web app grew fast over five rounds: flat `components/` folder, CSS modules plus ~74 inline styles, hand-rolled menus and popups, tests written directly against components. Kingsley wants it to read like a well-kept production frontend (same shape as their Wishflo frontend), with proven primitives where reliability matters, and wants 16 visible fixes made at the same time.

## Goals

1. Every component in its own folder with its test, story and helpers; reusable UI pieces in a separate `ui` folder.
2. Tailwind for all styling; CSS modules and inline styles gone (except values computed at runtime, e.g. drag transforms).
3. shadcn (Radix-based) for the core interactive primitives that need the most edge-case coverage.
4. Component tests render Storybook stories through `composeStories` in the React Testing Library + Vitest setup.
5. The round 3 fixes below.

## Non-goals

- No visual redesign beyond the listed fixes. Colours, fonts, spacing and the oklch token palette stay as they are.
- No changes to core, server or the board's data format (one sample-data change, see fix 10).
- No new features beyond the list. Live chat mirroring and the Add project form stay deferred.

## Anti-goals (a failure even if it "works")

- Losing behaviour or test coverage in the move: every existing test's intent must survive (rewritten as story-based tests where it tests a component).
- Visual drift: the board must look the same after the Tailwind rewrite, apart from the fixes.
- Half-migrated state: no component left with both a CSS module and Tailwind at the end.

## Approaches

| | Approach | Trade-off |
|---|---|---|
| **A (picked)** | Foundation first: set up Tailwind, shadcn and the folder layout, then rewrite each component once, folding in its fixes as it's touched. | One pass per component, no CSS written twice. First visible fix arrives later. |
| B | Do the 16 fixes in the current CSS, push, then refactor. | Fixes sooner, but most of that CSS gets thrown away. |
| C | Fixes and refactor in parallel. | Same double work, plus merge conflicts in every component. |

Kingsley picked A.

## Decisions

### Foundation (my calls unless marked)

- **Tailwind v4** via `@tailwindcss/vite`. The existing tokens in `styles/tokens.css` stay as CSS variables (light/dark under `[data-theme]`) and are exposed to Tailwind with `@theme inline` (e.g. `bg-card`, `text-fg2`, `border-line`, `text-accent-ink`, `bg-done-soft`). Dark mode is a custom variant on `[data-theme=dark]`, so the existing theme switch keeps working. Keyframes (`sbPulse`, `sbSpin`, `sbIn`) become Tailwind animations.
- **shadcn/ui** (Radix primitives, `components.json`, `cn()` helper with `clsx` + `tailwind-merge`), only for:
  - `dropdown-menu`: logo menu (with the Theme submenu), project switcher, milestone picker, filter dropdowns.
  - `dialog`: replaces the hand-rolled `Modal` (focus trap, Escape, scroll lock). The discard guard and pop guard keep working on top of it.
  - `drawer` (vaul): mobile filters, and dropdowns on narrow screens.
  - `popover`: click-to-open info (obsolete reason, manual notice, waiting markers).
  - `tooltip`: hover/focus labels for icon-only buttons.
  - `switch`: Blocked only, Simple mode, Track tokens.
  - `toggle-group`: Board | Table.
  
  Everything else stays hand-written in Tailwind. dnd-kit, driver.js, react-markdown and react-icons stay.
- **Folder layout**, following Wishflo (kebab-case folder and file names):
  ```
  src/components/
    ui/                     shadcn + reusable presentational pieces
      button/ dialog/ dropdown-menu/ drawer/ popover/ tooltip/ switch/ toggle-group/
      status-chip/ category-tag/ urgency/ skeleton/ markdown/ modal/ responsive-menu/
    top-bar/  top-bar.tsx  top-bar.stories.tsx  top-bar.test.tsx  (helpers when needed)
    board/  column/  spec-card/  table-view/  filter-bar/  footer/ ...
    card-detail/  (detail parts each get their own folder under card-detail/)
  src/assets/   logo + "not connected" icon
  ```
  Each folder holds `<name>.tsx`, `<name>.stories.tsx`, `<name>.test.tsx`, plus any helpers it alone uses. No barrel files. `lib/`, `state/`, `api/` keep their current shape (logic, not components).
- **Tests:** `src/test/setup.ts` calls `setProjectAnnotations` with the Storybook preview, so stories render in happy-dom unit tests with their decorators. Component tests become `const { Default, Narrow } = composeStories(stories); render(<Default />)` followed by RTL assertions. Pure logic tests (`lib/`, `state/`) stay as they are. The browser story run (`npm run test:stories`) stays. Every component folder has at least one story and one test.
- **Responsive menus:** a small `ui/responsive-menu` wrapper renders a shadcn DropdownMenu on wide screens and a bottom Drawer on narrow ones (`useNarrow`, 720px and under, see "Calls made after the builder check"). Wide-screen dropdowns use Radix collision handling, so they never run off the page.

### Round 3 fixes

1. **Board/Table toggle** uses icons (grid and table) with tooltips, as a toggle group.
2. **Mobile filters:** on narrow screens Category, Urgency and Blocked only move into a "Filters" button that opens a bottom drawer (badge shows how many are active). Dropdowns that overflowed on mobile (project switcher, logo menu, milestone, filters) open as drawers there.
3. **"Not connected" indicator:** the "i Manual" chip is replaced by `spec-board-non-agentic.svg` shown as an icon with rounded corners. Clicking it opens a popover: title **"Claude isn't connected to the board"**, then the existing explanation and docs link. The wording "non-agentic" and "Manual mode" is removed from the UI, docs and README.
4. **Logo:** `spec-board-logo.svg` replaces the current logo mark in the header, and is used as the favicon. Both SVGs move from the repo root to `packages/web/src/assets/` (favicon copy in `public/`).
5. **Table columns line up** across milestone groups: all groups share one fixed column template (`table-layout: fixed` + shared column widths).
6. **Logs button** sits at the right end of the header in both regular and Simple mode.
7. **Header buttons** References, Overview and Logs get icons (book, chart, scroll).
8. **Simple mode toggle** moves from the filter bar to the main header (into the logo menu on narrow screens).
9. **Theme submenu:** "Dark mode" becomes "Theme ▸ Light / Dark / System". System follows the OS setting live; saved in `specboard.theme` as `light|dark|system`; default System.
10. **Archived cards on the board:** cause found: the milestone dropdown hides T-100 (no milestone) while "Show archived (1)" still counts it. Fix: the "Show archived (N)" count uses the current filters and the toggle hides when N is 0; the sample's T-100 gets `milestone: Basics` (it is the scaffold, so it belongs there).
11. **Tests and stories:** see Foundation.
12. **Less space** between the board columns and the page bottom (the empty band above the horizontal scrollbar).
13. **Logs as a two-column grid:** left column the time, right column the spec/subtask titles and text. Times show as "time ago" (Intl.RelativeTimeFormat, no new library) up to 30 days, then `YYYY-MM-DD HH:mm`; the exact time sits in a tooltip. The day group headings go (the left column replaces them); search stays.
14. **Popups for icon-only items:** every icon-only button or indicator gets a Tooltip (label) or, when it carries information (obsolete reason, not-connected notice, waiting markers), a Popover that also works on touch.
15. **Footer** content centred; the Add spec button stays bottom-right.
16. *(question, answered in chat)* Skills live in `plugin/skills/`. The README gains a line saying so.
17. **Milestone picker** looks like the project title: bold name, done/total ("Basics · 2/3"), chevron; no input box.

### Docs

README and `docs/guide/*` updated for: not-connected wording, Simple mode toggle location, Theme submenu, logs layout, where skills live, and a short "Frontend layout" section (folders, Tailwind, shadcn, story-based tests) in the contributor part of the README.

## Calls made after the builder check

- **Header split (fix 6):** Logs is always in the header, at the right end, in regular, Simple and narrow modes (icon-only with a tooltip on narrow screens). It is never in the logo menu. References and Overview stay in the header in regular mode and move to the logo menu in Simple mode or on narrow screens, as today. Header right side, regular: Simple mode switch, not-connected icon (when shown), References, Overview, Logs.
- **Breakpoint:** `useNarrow` stays at `max-width: 720px` everywhere, the new drawers included. The "768px" above is replaced by this: no layout moves between 721 and 767px.
- **Fix 10 data:** edit `examples/recipe-box/.specboard/archive/T-100-project-scaffold/spec.md` and `web/src/fixtures/recipeBox.ts`. Core/server tests that read the sample may be updated only where they assert on T-100's milestone. The "Show archived (N)" count uses the board's own filters (category, urgency, milestone, search), and ignores Blocked only for archived cards.
- **Proving "looks the same":** before migrating, take Playwright screenshots of key screens (board, table, card detail, overview, logs; light and dark; 1280px and 375px) from the sample project. Take them again after migrating, and the controller compares each pair by eye. This is not a strict pixel diff, and only the listed fixes may differ.
- **Plugin bundle:** the refactor ends with `npm run build:plugin`, and the rebuilt `plugin/web` is committed.

## Tracking

The plan has a Tailwind migration checklist with one line per component; each is ticked when that component has no CSS module and no static inline styles. At the end `src/**/*.module.css` must not exist.

## Left to the builder

- Exact Tailwind class choices that reproduce today's look.
- Icon choices from react-icons (Lucide set) within the meanings above.
- How to split large components (CardDetail, TopBar) into sub-components while moving them.
