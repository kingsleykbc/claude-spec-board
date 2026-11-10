# Better specs: spec-writing skills (design)

Date: 2026-11-10. Status: waiting for Kingsley's approval.

## Why

Kingsley kept having to remind Claude to do the same things when working from specs (Wishflo's phase plans are the example):

- update the documentation once a task is finished;
- add a testing step at the end when the project wants tests.

Spec Board's skills also only cover one spec at a time. There is nothing for starting a project, bringing in an existing codebase, importing plans written for other tools, or reorganizing the board.

The goal stays the same as the rest of Spec Board: **a simple, manageable way to track projects. The most insight for the person, with the least friction, digging or confusion.** Wherever simplicity and thoroughness pull apart, simplicity wins now and the thorough version goes into the future plans as the "Robust" preset.

We borrow OpenSpec's *principles* (agree before you build, small checkable steps, brownfield-first, a clear "done") but **not** its model of living `specs/` plus change deltas. Spec Board stays one card per piece of work.

## Goals

1. Every spec ends with the project's own closing steps (tests, docs) without anyone asking.
2. Every spec says plainly what "done" means, and Claude checks it before moving the card to Review.
3. Things only the person can do (supply a design, add a key, test on a phone) are in the spec, in order, and a run stops at them.
4. One command sets a project up, new or existing.
5. Plans from other tools (Spec Kit, OpenSpec, free-form plans like Wishflo's) can be turned into cards.
6. The board can be reorganized (split, merge, reorder, fix dependencies) in one go.

## Non-goals

- OpenSpec's living specs, deltas (ADDED/MODIFIED/REMOVED) and archive-merging.
- A separate `validate` CLI or `/verify-spec` command. The board already flags broken files, and the "Done when" check covers verifying the work.
- "Not in this spec" / out-of-scope sections, size limits, files-touched lists, RFC 2119 wording, Given/When/Then scenarios. These are "Robust" preset material (future).
- Supporting projects that span several repos (Wishflo spans three). The import works on one project folder; see the import rules.

## Anti-goals (a failure even if it works)

- Specs that feel heavier to read or answer than today.
- New concepts on the board where an existing one does the job.
- An import that edits or deletes the source files.

## What a spec looks like

Unchanged grammar, plus one new section and one subtask marker. Old specs stay valid.

```spec
---
id: T-012
title: Checkout page
status: todo
urgency: normal
categories: [Frontend]
depends_on: [T-010]
draft: false
current_subtask: null
created: 2026-11-10
updated: 2026-11-10
---

## Spec
Customers review their basket and pay in one page. (The first sentence explains the whole spec on its own, because the card shows the start of the description.)

## Features
- Basket summary
- Card payment

## Done when
- A customer can pay for a basket with a test card and sees the confirmation.
- An empty basket shows "Your basket is empty" and no pay button.

## Open questions
- [ ] Q1 (optional choice: Stripe | Paystack): Which payment provider? (recommended: Paystack)
  > answer:

## Subtasks
- [ ] 1. (you) Add the checkout design to designs/
- [ ] 2. Build the basket summary
- [ ] 3. Wire up card payment
- [ ] 4. Write tests
- [ ] 5. Update the docs
- [ ] 6. (you) Try a payment on your phone
```

### First sentence
The `## Spec` section opens with one sentence that explains the spec on its own. Writing rule only, in the skills.

### `## Done when`
- 2 to 5 plain-language checks of what the person will see or be able to do. Observable results, not implementation.
- Kept as an ordinary extra section. The parser already keeps unknown sections and the detail view already shows them as part of the spec body, so **no parser or board change**.
- Before setting `status: review`, Claude checks each line and writes the result (met / not met, and how it checked) in the log of the last subtask it did. If a line is not met, it does not move the card to Review: it fixes it, or adds a required question and stops (the existing "never guess" rule).
- Specs without the section keep working; Claude just has nothing extra to check.
- Writing rule: prefer checks a test or the code can prove. Something only a person can see (on a phone, in a browser) goes in a `(you)` check at the end instead.
- A line Claude cannot check itself (no tool for it) is written in the log as "needs your check", and does **not** block Review or become a question. Only a line Claude checked and found not met blocks. *(Claude's call: otherwise most runs would end on a question.)*
- If no subtask was done in the run that does the check, the result goes in the log of the last code subtask, as a new dated entry.

### `(you)` subtasks
- A subtask whose title starts with `(you) ` is for the person: `- [ ] 3. (you) Add the API key to .env`.
- Placement: things needed before the work go first, checks the person does afterwards go last.
- Running: when a run reaches an unticked `(you)` subtask **that has Claude's work after it**, Claude sets `current_subtask: null`, keeps `status: doing`, says exactly what is needed, and stops. It never ticks a `(you)` subtask itself. The person does it and ticks it on the board (subtasks are already tickable there), then runs again.
- `(you)` subtasks **at the end** (checks the person does afterwards) do not stop the run. When only those are left, Claude does the Done-when check and moves the card to Review, listing the `(you)` steps still to do. They are part of the person's review. *(Claude's call, from the builder check: otherwise every spec would need a second run just to reach Review.)*
- Run panel: a run that stops at a `(you)` step must read as a calm pause ("Waiting on you: <step>"), not as "Claude stopped before finishing". This needs a new end state in the server's run classification (`packages/server/src/claude/classify.ts`, `runs.ts`) and its wording in the web run panel, with tests. *(Claude's call: an error on every `(you)` step would go against "least confusion".)*
- Questions stay for **decisions** ("Email or SMS?"); `(you)` subtasks are for **things the person does**.
- Board: the card detail shows a small "you" tag in place of the `(you) ` prefix on those subtasks. This is the only UI change. (Builder's call how it looks; it must work in light, dark and Simple mode.)
- A `(you)` subtask has no commit; its log, if any, just records when it was confirmed.

### Closing steps (per project)
- New optional key in `.specboard/config.md`: `closing_steps: [Write tests, Update the docs]`.
- `/plan-project` sets it from the person's answers. People can edit it by hand.
- `create-spec` (and every skill that writes subtasks) ends each new spec's subtasks with these steps, in order, unless the spec plainly does not need one (for example a docs-only spec gets no "Write tests"). It says so when it leaves one out.
- "Write tests" means using the test command already in `.claude/settings.json` (the existing run rule). "Update the docs" means the docs named in `references` in config.md plus the README.
- `parseConfig` keeps ignoring keys it does not know, so this needs no core change unless the builder wants the board to show it (not required).

## The skills

All live in `packages/server/kit/skills/` and are installed by `specboard init` as today. Every command skill starts by loading the `specboard` skill, as the existing ones do.

### `specboard` (updated)
- Add `## Done when`, `(you)` subtasks and `closing_steps` to the format description and the complete example.
- Add a short "Writing a good spec" part: first sentence, Done when, small subtasks each doable and checkable on its own, closing steps last, `(you)` items in their place, questions only for real decisions (with recommendations, as now).
- Running a spec: the `(you)` stop rule and the Done-when check before Review.

### `create-spec` (updated)
- New first step, **clarify**: before writing, ask the person the 2 or 3 questions whose answers would change the spec most, in the chat, and wait. Everything else goes on the board as open questions, as now. If the idea is already clear, skip straight to writing and say so.
- When it runs from the board ("Have Claude write this up"), there may be no one to answer in the chat: then skip the clarify step and put those questions on the board. (Builder: check how the board starts it and make the skill tell the two apart, for example by an argument.)
- Writes Done when, closing steps and any `(you)` subtasks.

### `/plan-project` (new)
One command for a new project or an existing codebase.
1. Look at the folder. If there is code, read enough of it (README, package files, main folders, existing docs) to describe what it does today. This is brownfield-first: describe what exists before planning changes.
2. Ask the person a few questions in the chat, one at a time: what the project is for (skip or confirm if the code already shows it), whether they want tests and with what command, which docs should be kept up to date.
3. Write `.specboard/config.md`: name, description, `references` (existing docs worth reading), `closing_steps`.
4. Suggest the first specs as a short list (title + first sentence + order). On the person's OK, create them as **drafts** (`draft: true`) with `depends_on` set, so they can be written up one at a time with `create-spec`. Do not write full specs in bulk.
5. Never change code. If `config.md` already exists, show what would change and ask first.
- It does not install anything: `specboard init` still does the `.claude/` setup. If the project is not initialised, say so and give the init command.

### `/import-specs <path>` (new)
Turns another tool's plans into cards. Known shapes: Spec Kit (`specs/<n>-<name>/spec.md, plan.md, tasks.md`), OpenSpec (`openspec/changes/<name>/proposal.md, tasks.md`, and `openspec/specs/` as background), and free-form plans (a roadmap README plus task files, like Wishflo).
1. Read the source. Show the person a short mapping first: which cards will be made, from which files, and anything it cannot place. Wait for an OK.
2. One card per task / change / feature. Map: description → `## Spec` (first sentence rule), acceptance criteria / scenarios → `## Done when` (shortened to plain checks), task lists → `## Subtasks` (done items stay ticked, human-only items become `(you)`), open points → open questions, order and "depends on" notes → `depends_on`, status → `status` (done work → `review` at most, since only a person sets done; the summary says which to move to Done).
3. Each imported spec gets a line at the end of `## Spec` naming its source file, so nothing is lost.
4. Add the closing steps only to cards that are not already finished.
5. **Never edit, move or delete the source files.**
6. Plans that span several repos: import into the project the person ran it in; tasks that clearly belong to another repo are listed in the summary and not imported, unless the person says otherwise.

### `/reorganize [instructions]` (new)
Board-wide tidying: split a big spec into several, merge small ones, reorder, fix `depends_on`, re-categorise.
1. With instructions, do those. Without, look for: specs over about 8 subtasks, near-duplicates, missing or circular dependencies, specs missing Done when or closing steps. Propose changes as a short list and wait for an OK.
2. Same safety rules as `update-spec`: ticked subtasks and anything with logs keep their numbers; given answers are kept; never set `done`; a split keeps the original ID on the first part and gives new IDs to the rest; a merge archives nothing by itself (it says which card can be archived).
3. Finish with what changed.

### Unchanged
`update-spec`, `correct-specs`, `run-spec`, `next`, `refresh-logs`, `refresh-overview` keep working. `update-spec` and `correct-specs` learn the new section and marker through the `specboard` skill. `run-spec`/`next` get the `(you)` stop and the Done-when check through the same skill.

## Docs to update
- `docs/guide/writing-specs.md`: Done when, `(you)` subtasks, closing steps.
- `docs/guide/commands.md` and the README command list: the three new commands.
- `docs/guide/getting-started.md`: `/plan-project` as the first step after `init`.
- `docs/documentation.md`: the format additions.
- `docs/future-features.md`: add the items below.
- The sample `examples/recipe-box`: give a few specs a Done when section, closing steps in config.md, and one `(you)` subtask, so the board shows them. (Kingsley's uncommitted test edits there must be left alone.)

## Future plans (add to docs/future-features.md)
- **Setup presets.** `/plan-project` asks Simple or Robust. Simple is what this design builds. Robust adds more detailed questions, full acceptance criteria (scenarios), out-of-scope, approach/design notes, files touched, and size limits.
- **Design docs.** A place for a spec's design (images, Figma links, Markdown) that the board shows and runs read; `(you)` "add the design" steps would point at it.
- **Claude artifacts.** Link or embed Claude artifacts (mockups, prototypes, write-ups) in a spec, and let Claude publish one from a spec.

## Constraints
- Windows 11, Node 22, the existing npm workspaces. No new dependencies.
- Skills are plain Markdown and must stay short and plain, like the existing ones.
- Existing specs and boards keep working unchanged.
- Board changes limited to the "you" tag and the "Waiting on you" run end; all tests and stories keep passing, with new ones for the tag and for any kit test that lists the skills.

## Left to the builder
- How the "you" tag looks.
- Exact wording of the skills, within the rules above.
- How `create-spec` tells a board start from a chat start.
- Whether the kit tests need updating for the new skills (they probably list them).
