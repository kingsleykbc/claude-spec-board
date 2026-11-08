---
id: T-105
title: Shopping list export
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

Let a user export the shopping list generated from the meal planner.
The export should be easy to print or share.

## Features

- Export the list for the planned weeks
- Group items by aisle
- Choose an export format

## Open questions

- [x] Q1 (yesno): Should the export include quantities?
  > answer: yes
- [ ] Q2 (number): How many weeks ahead should the list cover?
  > answer:
- [ ] Q3 (choice: PDF | CSV | Plain text): Preferred export format?
  > answer:

## Subtasks

- [ ] 1. Build the shopping list from planned meals
- [ ] 2. Merge duplicate ingredients
- [X] 3. Add the export endpoint

## Notes

Anything here is kept untouched.
