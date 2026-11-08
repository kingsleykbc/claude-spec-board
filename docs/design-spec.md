# Design Brief: Spec Board

> **For the designer.** This brief comes with a rough hand-drawn sketch of four screens. Use the sketch for **layout and structure**. Use this brief for **every feature, state and detail**. Please turn it into a polished, consistent UI design covering all screens and states listed below.

---

## 1. What the product is

**Spec Board** (working name) is a local web app for developers who build software with **Claude Code**, Anthropic's AI coding agent.

The developer and Claude plan work as **specs**: Markdown files in the project folder. Each spec describes a feature and contains open questions and a list of subtasks. Claude creates and updates these files, then works through the subtasks.

The problem is that reading progress from raw Markdown files and terminal output is tedious. Spec Board shows the same files as an **interactive kanban board**. The user can see progress at a glance, read specs comfortably, answer Claude's questions with real form inputs, edit specs, and tell Claude to start working, all from one place.

Every change on the board is saved straight back into the Markdown files, and changes Claude makes to the files show up on the board **live**. The board and the files always match.

**The user:** a solo developer on a laptop or desktop browser (Windows first). They're technical, but they open the board to *see* things fast rather than to read walls of text.

**Design goals, in order:**
1. **Glanceable.** Within 3 seconds the user should know what's done, what's in progress, what's blocked, and what's waiting on them.
2. **Pleasant to read.** Specs and logs are long-form text and should read like good documentation, not like a code editor.
3. **Clear about what needs the user.** Anything that waits on a human (unanswered questions, cards in Review) should stand out without being noisy.
4. **Calm and professional.** It's a developer tool and a portfolio piece: clean, modern and confident. Avoid generic template looks.

Deliver **light and dark themes**. Design desktop-first (1280–1920px wide). It only needs to stay usable down to about 1024px; no mobile layout is needed.

---

## 2. Global layout

### Top bar (on every screen)
From left to right, as in the sketch:
- **Logo / product name:** "SPEC-BOARD".
- **Project switcher:** the current project name with a ▾ dropdown. It lists the other projects the user has opened, each with a small progress hint (e.g. "4/12 done"). The current project is ticked.
- *(flexible space)*
- **References** button: opens the Reference Documents modal.
- **Overview** button: opens the Overview modal.
- **Live-sync indicator** (small): shows that the board is connected and watching the files. It has three states: *Live* (normal), *Reconnecting…*, and *Disconnected*.
- **Theme toggle** (light/dark).

### Modals
The Card Detail, Overview, References, Add Spec and Log views open as **modals over the board**. The board stays visible and dimmed behind, as in the sketch. Every modal has a close (×) control and closes with Esc.

---

## 3. Screens

### 3.1 Board (main screen)

**Columns:** **To-do, Doing, Review, Done.** Each column header shows its name and a card count.

- **Review** means "Claude has finished; the human needs to check it". Make it stand out a little so the user notices waiting work.
- Only the human moves cards into **Done**. That's their approval.

**Spec card** (on the board). Each card shows:
- **Spec ID**, e.g. `T-123`, small and monospace.
- **Title**, e.g. "Booking page".
- **Short description:** 2 lines, then cut off.
- **Subtask progress:** a small bar or fraction, e.g. `3/7`.
- **Blocked badge:** shown when the spec has unanswered open questions or depends on an unfinished spec. Use the same red/pink as the blocked banner in the card detail. On hover it shows why, e.g. "2 open questions" or "Waiting on T-120".
- **Running indicator:** shown when Claude is working on this card right now, e.g. a subtle animated pulse or spinner with "Claude is working".
- **Categories:** one or more small coloured tags, e.g. `Frontend`, `Backend`, `Infra`. Categories are free text, and each one gets a consistent colour automatically.
- **Urgency:** one of four levels, **Low, Normal, High, Urgent**, shown as a small icon plus label (e.g. flag or chevrons). Normal can be visually quiet. Urgent must be noticeable at a glance without shouting.
- **Dependencies and dependents:** a compact line such as "⤴ needs T-101, T-102 · ⤵ needed by T-108". If there are many, show counts ("needs 3 · needed by 2"), with the full list on hover. A dependency that isn't Done is marked (it causes the Blocked badge).
- **View** button (as sketched). Clicking anywhere on the card also opens it.

Within a column, cards are sorted by **urgency first** (Urgent at the top), then by ID.

**Filter bar** (just under the top bar): filters by **category** and by **urgency**, plus a "Blocked only" toggle. Show active filters as removable chips and a "Clear" link. Keep it compact so it doesn't take focus from the board.

**Card states to design:** default, hover, being dragged, drop target (column highlight), blocked, running, and in Review (waiting on the user).

**Drag and drop:** cards can be dragged between columns. Show a clear drop placeholder. The user can also change status from the card detail's status dropdown.

**+ Add new spec** button: bottom-right of the board, as in the sketch. It could be a floating button or sit at the foot of the To-do column; designer's choice.

**Archive:** Done cards can be archived, which hides them from the board. Add an "Archive" action on Done cards (e.g. a hover menu) and a small "Show archived (n)" toggle near the Done column.

**Empty states:**
- An **empty project** (no specs yet): a friendly empty board with a message such as "No specs yet. Add one, or ask Claude to `/create-spec`", and the Add button.
- An **empty column:** a quiet placeholder.

---

### 3.2 Card detail (modal)

This is the most important screen. From top to bottom, following the sketch:

**Header**
- **Spec ID** (`T-123`) and **title** ("Task Name" in the sketch).
- **▷ Run** button labelled "Tell your agent to start" (or similar), top-right area. It starts Claude working on this spec. States:
  - *Ready* (default)
  - *Running*: it turns into a **■ Stop** button, and a run-output panel appears (see below)
  - *Disabled* when another spec in the project is already running, with the tooltip "Claude is already working on T-118"
  - *Fallback* when Claude Code isn't installed: the button becomes **Copy command**, then shows a "Copied: paste it into Claude Code" confirmation
- **Status dropdown** (top-right corner; the sketch shows "TODO ▾"), with To-do / Doing / Review / Done.
- **Urgency selector** (Low / Normal / High / Urgent) and **category tags** under the title. Both are editable here: the user can pick a level, and add or remove categories (with suggestions from categories already used in the project).
- Close (×).

**Spec section**
- A bordered panel titled **SPEC**, with an **✎ Edit** button at its top-right.
- It holds the spec description, a **FEATURES** subheading and a feature list, all rendered as nicely formatted Markdown (headings, lists, code, bold).
- **Edit mode:** the panel becomes a Markdown editor (raw text, ideally with a live preview or split view), with **Save** and **Cancel**. Design both read mode and edit mode.

**Open questions section**
- A panel titled **OPEN QUESTIONS**. These are questions Claude wrote because it needs the user's decision before continuing.
- Each question is numbered and has the input that fits its type:
  - **Yes / No:** two checkboxes or a segmented toggle, e.g. "1. Do you want an X button? ☐ Yes ☐ No"
  - **Number:** a small number input, e.g. "2. Enter number of versions [ ]"
  - **Text:** a single-line or multi-line text box
  - **Single choice:** radio options or a select
- A **Save changes** button at the bottom of the panel. It's disabled until something changes.
- **States:** unanswered (subtly highlighted), answered (calm, with the answer shown), saving, saved (brief confirmation), and the **empty state** "No open questions".

**Dependencies section** (not drawn in the sketch; please place it)
- **Depends on:** the specs this one needs first. Each shows its ID, title and a status chip, and is clickable to open that spec.
- **Needed by:** the specs that depend on this one, in the same style.
- If a dependency isn't Done, mark it clearly. It contributes to the Blocked state.

**Subtasks section**
- A panel titled **SUBTASKS**: a checklist.
- Each row has a **checkbox**, the **subtask name**, and, if Claude has logged work for it, a **≡ Log** link on the right (as sketched).
- The subtask Claude is working on right now gets an "in progress" marker.
- The user can tick and untick boxes too.
- Show progress at the top of the panel, e.g. "2 of 3 done".

**Blocked banner**
- A red/pink outlined banner at the bottom of the modal (as sketched), e.g. **"! Blocked. Awaiting answers on: No. of versions"**, or "Blocked. Waiting on T-120 (Doing)".
- It's only shown when the spec is blocked. Clicking it scrolls to the questions or dependency involved.

**Run output panel** (shown while Claude is running, and afterwards until dismissed)
- A live, scrolling feed of what Claude is doing, e.g. "Editing src/booking.tsx…", "Running tests…", "✓ Subtask 2 done: committed a1b2c3d".
- It should feel readable rather than like a raw terminal. Monospace is fine for file names and commands, but use a friendly structure.
- **End states:**
  - *Finished*: "Done. Moved to Review."
  - *Stopped by user*
  - *Stopped: needs your answer*: Claude asked a new open question. Link to it.
  - *Stopped: permission needed*: Claude tried something it isn't allowed to do. Explain it briefly and suggest a fix.
  - *Error*

**Log view** (opened from a subtask's ≡ Log link)
- This can be a nested modal, a slide-over panel, or an expanding section; designer's choice.
- It shows the log Claude wrote for that subtask: a dated list of entries saying what changed and why, the **files changed** (as a list), and the **commit** (short hash) for that subtask.
- It's read-only.

---

### 3.3 Overview (modal)

As in the sketch:
- Title **OVERVIEW**.
- The **project name**, large.
- A **progress ring** in the top-right showing "2/10 Complete" (specs done out of the total).
- A **project description** paragraph.
- A **PROGRESS** section: a written summary of what's done and what's left. Claude writes this text. Show a small "Last updated 2h ago" note and a **Refresh** action that asks Claude to rewrite it.
- *Optional but welcome:* a compact count per column (To-do 4 · Doing 1 · Review 2 · Done 3 · Blocked 1).
- An **⇪ Export** button in the bottom-right. It downloads the overview as a Markdown file.
- **Empty state:** if no summary has been written yet, show "No summary yet. Ask Claude to refresh the overview" and the Refresh button.

---

### 3.4 Reference documents (modal)

As in the sketch:
- Title **REFERENCE DOCUMENTS** and a **+ Add** button in the top-right.
- A **tab row** of documents: `CLAUDE.md`, `CONTEXT.md`, `RULES.md`, and so on. When there are many, the tabs scroll sideways and an arrow **›** appears.
- The active document is shown rendered as nicely formatted Markdown.
- An **✎ Edit** button (bottom-right in the sketch) switches to a Markdown editor with **Save** and **Cancel**, in the same style as the spec editor.
- **+ Add** opens a small choice:
  - **Link an existing file** from the project (a file path picker or text field)
  - **Create a new document** (enter a name)
- A way to **remove** a document from the references list. This removes the link only and doesn't delete the file; say so in the confirmation.

---

### 3.5 Add new spec (modal)

- Fields: **Title** and **Description**, where the user describes the idea in plain words.
- Actions:
  - **Add as draft:** creates the card in To-do with a "Draft" tag.
  - **Add & have Claude write it up** (primary): creates the card and asks Claude to flesh it out into a full spec, with features, open questions and subtasks.
- Design the **Draft** tag on a board card too. A draft card also offers "Have Claude write this up".

---

## 4. Feedback and system states

Please design these small states as well:

- **Toast notifications:** saved, copied, a run started, a run finished ("T-123 moved to Review"), and errors.
- **Edit conflict:** the user was editing, but the file changed on disk (Claude or another editor touched it). Show a non-scary dialog or banner: "This spec was changed outside the board. Reload to see the latest version?" Offer to keep a copy of the user's unsaved text.
- **Live update highlight:** when Claude changes a card while the user is looking (a ticked subtask, a status move), briefly highlight what changed.
- **File problem:** a spec file Claude or the user edited by hand has a formatting mistake. Show a warning icon on that card, and in the detail view, a short explanation with the file path.
- **Disconnected:** the board lost its connection to the local server. Show a banner with a reconnect state.

---

## 5. Visual direction

- **Mood:** calm, focused developer tool, closer to Linear or Things than to Jira. Generous whitespace. Content first.
- **Typography:** a clean sans-serif for the UI and for reading specs; monospace only for IDs, file paths, commit hashes and command output. Specs should feel like well-set documentation.
- **Colour:** a mostly neutral palette with one accent colour for primary actions (Run, Save, Add). Status colours:
  - To-do: neutral
  - Doing: blue-ish / accent
  - Review: amber, the "needs you" colour
  - Done: green
  - Blocked: red/pink, matching the banner in the sketch

  Don't rely on colour alone. Pair each status with a label or icon.
- **Cards:** clear but light. Avoid heavy shadows and borders everywhere.
- **Hand-drawn sketch:** the sketch's boxes and labels are structure only. Don't copy its sketchy style.
- **Accessibility:** good contrast in both themes, visible keyboard focus, and real checkbox/input semantics.

---

## 6. Sample content to use in the mockups

Use a neutral demo project so the screens feel real:

- **Project:** "Recipe Box". A web app to save and plan recipes.
- **Specs** (category · urgency):
  - T-101 "Recipe list page" (Done, 4/4) · Frontend · Normal
  - T-102 "Add recipe form" (Done, 5/5) · Frontend · Normal · needed by T-103
  - T-103 "Search & filters" (Review, 6/6) · Frontend, Backend · High · needs T-102
  - T-104 "Meal planner calendar" (Doing, 2/5, **running**) · Frontend · High · needed by T-105
  - T-105 "Shopping list export" (To-do, **Blocked**: 3 open questions) · Backend · Normal · needs T-104
  - T-106 "User accounts" (To-do, 0/7) · Backend, Auth · **Urgent** · needed by T-108
  - T-107 "Dark mode" (To-do, Draft) · Frontend · Low
  - T-108 "Share recipe link" (To-do, needs T-106 → Blocked) · Frontend · Normal
- **Open questions** on T-105:
  1. "Should the export include quantities?" (Yes/No)
  2. "How many weeks ahead should the list cover?" (Number)
  3. "Preferred export format?" (Single choice: PDF / CSV / Plain text)
- **Subtasks** on T-104: "Create calendar grid ✓", "Drag recipe onto a day ✓", "Persist planned meals (in progress)", "Week navigation", "Empty-day state". Give the two done subtasks a ≡ Log link each.
- **References:** CLAUDE.md, CONTEXT.md, RULES.md, API-NOTES.md, STYLE-GUIDE.md (enough to show the tab scrolling).

---

## 7. Deliverables checklist

Please produce designs for:

1. Board: populated (light **and** dark), empty project, a card being dragged, filter bar with active filters
2. Card states: default, hover, blocked, running, review, draft, file-problem, and all four urgency levels; cards with categories and with dependencies/dependents
3. Card detail: read mode, spec edit mode, open questions (unanswered and answered), dependencies, subtasks with an in-progress one, blocked banner
4. Card detail with the Run output panel: running, finished, needs answer, permission needed
5. Run button states: ready, running/stop, disabled, copy-command fallback
6. Log view for a subtask
7. Overview modal: with summary, and the empty state
8. Reference documents modal: read mode, edit mode, the + Add choice, many tabs scrolling
9. Add new spec modal
10. Project switcher dropdown open
11. Toasts, edit-conflict dialog, disconnected banner
12. A small component sheet: buttons, status chips, category tags, urgency indicators, badges, inputs (yes/no, number, text, choice), checkboxes, tabs, modal frame, colours and type scale for both themes
