---
id: T-105
title: "Shopping list export"
status: todo
urgency: normal
categories:
  - Backend
depends_on:
  - T-104
draft: false
current_subtask: null
created: 2026-11-01
updated: 2026-11-08
---

## Spec

Combine the ingredients from every meal in the planned week into one shopping list, then export it so it can be printed or sent to a phone.

## Features

- Collects ingredients from all planned meals in the chosen range
- Merges duplicates, so **2 x 200 g flour** becomes **400 g flour**
- Groups items by aisle: produce, dairy, pantry, other
- Exports in the format chosen below

## Open questions

- [ ] Q1 (yesno): Should the export include quantities? (recommended: Yes)
  > answer:
- [ ] Q2 (optional number): How many weeks ahead should the list cover? (recommended: 1)
  > answer:
- [ ] Q3 (choice: PDF | CSV | Plain text): Preferred export format?
  > answer:

## Subtasks

- [ ] 1. Collect ingredients from planned meals
- [ ] 2. Merge duplicate ingredients
- [ ] 3. Group by aisle
- [ ] 4. Export file
- [ ] 5. Export button on planner

## Depends on

Needs saved meals from T-104 (the `planned_meals` table).
