# Specs and questions

Everything lives in `.specboard/` in your project, as files you can read and edit by hand:

```
.specboard/
  config.md                  project name, description, reference documents, closing steps and milestones
  settings.md                optional, board settings (token tracking)
  overview.md                a summary of the project's progress
  specs/T-001-booking-page/
    spec.md                  the spec
    logs/1-page-scaffold.md  one log per subtask
  archive/                   archived specs
```

## A spec

```
---
id: T-001
title: Booking page
status: todo
urgency: normal
categories: [Frontend]
depends_on: [T-000]
draft: false
milestone: Basics
current_subtask: null
created: 2026-11-07
updated: 2026-11-07
---

## Spec
Customers pick a barber, a service and a time slot, then confirm.

## Features
- Barber picker
- Time-slot grid

## Done when
- A customer can pick a barber and a time slot and see a confirmation.
- A slot that is already taken can't be picked.

## Open questions
- [ ] Q1 (yesno): Should customers be able to cancel a booking? (recommended: Yes)
  > answer:
- [ ] Q2 (optional choice: Email | SMS | Both): How should customers be reminded? (recommended: Email)
  > answer:

## Subtasks
- [ ] 1. (you) Add the booking page design to designs/
- [ ] 2. Create the page scaffold
- [ ] 3. Build the time-slot grid
- [ ] 4. Write tests
- [ ] 5. Update the docs
- [ ] 6. (you) Try a booking on your phone
```

The first sentence under `## Spec` should explain the whole spec on its own, because the card shows the start of the description. `milestone` is optional; see Milestones below. `created` is the day the spec was made, and `updated` changes every time the spec is edited.

## Spec or subtask?

Claude uses these rules when it writes specs, and you can use them when you edit.

- A **spec** is a result you would want to follow as its own card. It changes what someone can see or do, has its own "Done when", can be reviewed on its own, and takes several sittings, about 2 to 8 subtasks.
- A **subtask** is one step toward a spec: one commit, one sitting, not worth reviewing alone.
- A **milestone** is a set of specs that ship together.

Signs a spec is too big: more than about 8 subtasks, "Done when" lines about unrelated things, or parts that could ship apart. Split it. Signs it's too small: it has one subtask, or it can't be reviewed apart from another spec. Merge it. In the sample project, "Meal planner calendar" is a spec, and "Calendar layout" and "Drag and drop" are its subtasks. "Basics" and "Planning" are milestones.

## Milestones

Bigger projects can group specs into milestones: Project, Milestone, Spec, Subtask. Small projects don't have any, and never need to think about them. The top group is called a milestone, not a phase, so it isn't confused with the phases some planning tools use inside one spec.

List them, in order, in `.specboard/config.md`:

```
milestones: [Basics, Sharing, Polish]
```

Then give each spec one in its front matter:

```
milestone: Basics
```

- A project has milestones when the list isn't empty. A spec with no milestone, or a name that isn't in the list, shows under **No milestone**, last. A name that isn't in the list is also flagged as a file problem.
- Specs can depend on specs in other milestones as usual.
- The **current milestone** is the first one in the list that has a spec that isn't done. If all are done, it's the last. The board opens on it, and `/specboard:next` picks from it first.
- To rename a milestone, change the list and every spec that uses the name, or ask `/specboard:reorganize`. It can also create and reorder milestones and move specs between them.

## Done when

A short list of what you will see or be able to do once the spec is finished, in plain words. For example:

```
## Done when
- A customer can pay for a basket with a test card and sees the confirmation.
- An empty basket shows "Your basket is empty" and no pay button.
```

Two to five lines is plenty. Each one is a result you can check, not a way of building it. Before Claude moves a spec to Review, it checks each line and writes in the log of the last subtask it did whether it was met and how it checked. If a line is not met, the card does not go to Review: Claude fixes it, or adds a required question and stops. A line Claude has no way to check is logged as "needs your check" and doesn't hold the card back. Something only you can see, such as how a page looks on a phone, belongs in a `(you)` step instead.

The section is optional. A spec without one works as before.

## Steps for you

A subtask that starts with `(you)` is something only you can do, such as adding a design or an API key, or trying the result on your phone:

```
- [ ] 1. (you) Add the checkout design to designs/
```

The card shows a small "you" tag on these. Claude never ticks one for you. Do the step, tick it on the board, then run the spec again.

- **A `(you)` step with work after it** stops the run. The run panel says **Waiting on you**, with the step, and it isn't an error.
- **A `(you)` step at the end** doesn't stop anything. Claude finishes, checks **Done when**, moves the card to Review and lists the steps still left for you.

Use a question for a decision ("Email or SMS?") and a `(you)` step for something you do.

## Closing steps

Some steps belong at the end of every spec, such as writing tests and updating the docs. Set them once in `.specboard/config.md`:

```
closing_steps: [Write tests, Update the docs]
```

`/plan-project` asks you about these and fills them in, and you can edit the line by hand. Every spec Claude writes after that has those subtasks after Claude's work, in order, ahead of any final `(you)` checks. It leaves one out when a spec plainly doesn't need it, a docs-only spec having no "Write tests", and says so. "Write tests" uses the test command already allowed in `.claude/settings.json`. "Update the docs" means the documents listed in `references` plus the README.

## Open questions

Each question has a type: `yesno`, `number`, `text` or `choice`, with a choice's options listed after a colon.

### Required and optional

| | Written as | If you leave it blank |
|---|---|---|
| **Required** | `(yesno)` | The spec is blocked and Claude won't start it |
| **Optional** | `(optional yesno)` | The spec can still run. Claude goes with its recommendation and says so in the subtask's log |

A question is required unless it says `optional`, so specs written before this existed keep working as they did.

Claude makes a question required when the work can't go ahead without your decision, and optional when there's a sensible default and a wrong guess is cheap to change.

### Recommendations

End a question with `(recommended: <value>)` to show what Claude would pick. The board shows it in brackets after the question. Every optional question should have one, and Claude adds one to any other question when it has a view.

A recommendation is only a suggestion: nothing is filled in for you, and a required question still needs your answer even if you agree with it.

## Subtask logs

Each subtask Claude finishes gets a log in `logs/<n>-<title>.md`, with a short entry for each sitting, headed by the date and time:

```
---
subtask: 2
commit: a1b2c3d
pr: https://github.com/you/your-repo/pull/12
tokens: 48210
done_at: "2026-11-07 16:40"
files:
  - src/components/RecipeSidebar.tsx
---

### 2026-11-07 16:40

Dropping on an empty slot places the recipe.
```

- `commit` is the commit for the subtask.
- `pr` is the pull or merge request link, when the branch has one. Claude looks it up with `gh` or `glab` and skips it if neither works.
- `tokens` is an approximate token count, filled in by the plugin. [Running a spec](running-specs.md#tokens) explains how it's counted. Claude never writes it.
- `done_at` is when the subtask was ticked, in your local time.
- `obsolete` appears after a [sync](running-specs.md#sync-with-code) finds that the work in a log no longer exists, for example `obsolete: "2026-11-10: the CSV export was replaced"`. The board shows a warning icon on the log. Sync never deletes or rewrites a log, and the tokens in an obsolete log still count, because they were spent.

## Settings

`.specboard/settings.md` is optional and holds only front matter:

```
---
track_tokens: true
---
```

`track_tokens` is on when the file or the key is missing. Turn it off with **Settings** in the logo menu on the board, which creates the file for you. When it's off, no tokens are recorded and the board hides the Tokens column and the total.

## Blocked

Blocked isn't a status. A spec is blocked when a required question is unanswered, or when a spec in `depends_on` isn't finished or doesn't exist. The card says which.

## Editing by hand

Change any of these files in your editor and the board updates. If a file has a formatting mistake, the card says so instead of failing, and offers **Ask Claude to fix**.

If a file changes while you're editing it on the board, your save is refused rather than overwriting the change, and the board offers to keep your text as a copy.
