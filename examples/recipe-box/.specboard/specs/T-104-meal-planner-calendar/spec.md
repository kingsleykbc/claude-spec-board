---
id: T-104
title: "Meal planner calendar"
status: doing
urgency: high
categories:
  - Frontend
depends_on: []
draft: false
current_subtask: 3
created: 2026-11-01
updated: 2026-11-08
---

## Spec

A weekly calendar where recipes can be dragged onto days. Planned meals are saved per user and feed the **shopping list** (T-105).

## Features

- Week view, Monday to Sunday, with breakfast, lunch and dinner slots
- Drag a recipe from the sidebar onto any slot
- Planned meals persist in `planned_meals` and survive reloads
- Previous and next week navigation, with **Today** to jump back

## Open questions



## Subtasks

- [x] 1. Create calendar grid
- [x] 2. Drag recipe onto a day
- [ ] 3. Persist planned meals
- [ ] 4. Week navigation
- [ ] 5. Empty-day state

## Notes

Reuse the card component from the recipe list. Keep the grid keyboard accessible: arrow keys move between slots and `Enter` opens the recipe picker.
