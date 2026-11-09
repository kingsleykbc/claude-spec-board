# Specs and questions

Everything lives in `.specboard/` in your project, as files you can read and edit by hand:

```
.specboard/
  config.md                  project name, description and reference documents
  overview.md                a progress summary
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
current_subtask: null
created: 2026-11-07
updated: 2026-11-07
---

## Spec
Customers pick a barber, a service and a time slot, then confirm.

## Features
- Barber picker
- Time-slot grid

## Open questions
- [ ] Q1 (yesno): Should customers be able to cancel a booking? (recommended: Yes)
  > answer:
- [ ] Q2 (optional choice: Email | SMS | Both): How should customers be reminded? (recommended: Email)
  > answer:

## Subtasks
- [ ] 1. Create the page scaffold
- [ ] 2. Build the time-slot grid
```

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

## Blocked

Blocked isn't a status. A spec is blocked when a required question is unanswered, or when a spec in `depends_on` isn't finished or doesn't exist. The card says which.

## Editing by hand

Change any of these files in your editor and the board updates. If a file has a formatting mistake, the card says so instead of failing, and offers **Ask Claude to fix**.

If a file changes while you're editing it on the board, your save is refused rather than overwriting the change, and the board offers to keep your text as a copy.
